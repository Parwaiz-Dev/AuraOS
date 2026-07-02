"""Vector Store — stores and retrieves document chunk embeddings.

Supports multiple backends:
- in_memory (default, no external dependency)
- qdrant (Qdrant vector database)
- pgvector (PostgreSQL with pgvector extension)

All backends enforce multi-tenant isolation via restaurant_id filtering.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class VectorEntry:
    """A stored vector with its metadata."""

    chunk_id: str
    document_id: str
    restaurant_id: str
    vector: "np.ndarray"
    text: str
    metadata: dict = field(default_factory=dict)


class VectorStoreBackend(ABC):
    """Abstract interface for vector storage and retrieval."""

    @abstractmethod
    async def upsert(self, entries: list[VectorEntry]) -> int:
        """Insert or update vector entries. Returns count stored."""
        ...

    @abstractmethod
    async def search(
        self,
        query_vector: "np.ndarray",
        restaurant_id: str,
        top_k: int = 5,
        document_type: str | None = None,
    ) -> list[tuple[VectorEntry, float]]:
        """Search for the most similar entries.

        Returns a list of (entry, score) tuples sorted by descending similarity.
        """
        ...

    @abstractmethod
    async def delete(self, document_id: str, restaurant_id: str) -> int:
        """Delete all entries for a document. Returns count deleted."""
        ...

    @abstractmethod
    async def count(self, restaurant_id: str | None = None) -> int:
        """Return the total number of stored vectors."""
        ...

    @abstractmethod
    async def clear(self, restaurant_id: str | None = None) -> None:
        """Remove all entries (optionally scoped to a restaurant)."""
        ...


class InMemoryVectorStore(VectorStoreBackend):
    """In-memory vector store using cosine similarity.

    Suitable for development and testing.  Not persistent across restarts.
    """

    def __init__(self) -> None:
        self._entries: list[VectorEntry] = []

    async def upsert(self, entries: list[VectorEntry]) -> int:
        # Remove existing entries for same chunk IDs
        new_ids = {e.chunk_id for e in entries}
        self._entries = [e for e in self._entries if e.chunk_id not in new_ids]
        self._entries.extend(entries)
        return len(entries)

    async def search(
        self,
        query_vector: "np.ndarray",
        restaurant_id: str,
        top_k: int = 5,
        document_type: str | None = None,
    ) -> list[tuple[VectorEntry, float]]:
        import numpy as np

        # Filter by restaurant
        candidates = [e for e in self._entries if e.restaurant_id == restaurant_id]
        if document_type:
            candidates = [e for e in candidates if e.metadata.get("document_type") == document_type]

        if not candidates:
            return []

        # Compute cosine similarity
        query_norm = query_vector / (np.linalg.norm(query_vector) + 1e-10)
        scored: list[tuple[VectorEntry, float]] = []
        for entry in candidates:
            vec_norm = entry.vector / (np.linalg.norm(entry.vector) + 1e-10)
            sim = float(np.dot(query_norm, vec_norm))
            # Clamp to [-1, 1] — float32 rounding can produce values like 1.0000001
            sim = max(-1.0, min(1.0, sim))
            scored.append((entry, sim))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    async def delete(self, document_id: str, restaurant_id: str) -> int:
        before = len(self._entries)
        self._entries = [
            e
            for e in self._entries
            if not (e.document_id == document_id and e.restaurant_id == restaurant_id)
        ]
        return before - len(self._entries)

    async def count(self, restaurant_id: str | None = None) -> int:
        if restaurant_id is None:
            return len(self._entries)
        return sum(1 for e in self._entries if e.restaurant_id == restaurant_id)

    async def clear(self, restaurant_id: str | None = None) -> None:
        if restaurant_id is None:
            self._entries.clear()
        else:
            self._entries = [e for e in self._entries if e.restaurant_id != restaurant_id]


# ------------------------------------------------------------------
# Qdrant backend
# ------------------------------------------------------------------


class QdrantVectorStore(VectorStoreBackend):
    """Persistent vector store backed by Qdrant.

    Multi-tenant isolation is enforced via a ``restaurant_id`` payload filter on
    every search. Vectors and their metadata persist in a single collection.
    """

    def __init__(self) -> None:
        try:
            from qdrant_client import AsyncQdrantClient
        except ImportError as exc:  # pragma: no cover - exercised only when dep missing
            raise RuntimeError(
                "qdrant-client is not installed. Install it to use RAG_VECTOR_DB=qdrant: "
                "pip install qdrant-client"
            ) from exc

        self._collection = settings.RAG_QDRANT_COLLECTION
        self._dim = settings.RAG_EMBEDDING_DIM
        self._client = AsyncQdrantClient(
            url=settings.RAG_QDRANT_URL,
            api_key=settings.RAG_QDRANT_API_KEY or None,
        )
        self._ready = False
        logger.info("Vector store: qdrant (collection=%s)", self._collection)

    async def _ensure_collection(self) -> None:
        if self._ready:
            return
        from qdrant_client.models import Distance, VectorParams

        exists = await self._client.collection_exists(self._collection)
        if not exists:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
            )
            logger.info("Created Qdrant collection %s (dim=%d)", self._collection, self._dim)
        self._ready = True

    @staticmethod
    def _point_id(chunk_id: str) -> str:
        """Derive a deterministic UUID point id from a chunk id (Qdrant requires UUID/int)."""
        import uuid

        return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))

    async def upsert(self, entries: list[VectorEntry]) -> int:
        if not entries:
            return 0
        await self._ensure_collection()
        from qdrant_client.models import PointStruct

        points = [
            PointStruct(
                id=self._point_id(e.chunk_id),
                vector=[float(x) for x in e.vector.tolist()],
                payload={
                    "chunk_id": e.chunk_id,
                    "document_id": e.document_id,
                    "restaurant_id": e.restaurant_id,
                    "text": e.text,
                    "metadata": e.metadata,
                    "document_type": e.metadata.get("document_type"),
                },
            )
            for e in entries
        ]
        await self._client.upsert(collection_name=self._collection, points=points)
        return len(points)

    async def search(
        self,
        query_vector: "np.ndarray",
        restaurant_id: str,
        top_k: int = 5,
        document_type: str | None = None,
    ) -> list[tuple[VectorEntry, float]]:
        import numpy as np
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        await self._ensure_collection()

        must = [FieldCondition(key="restaurant_id", match=MatchValue(value=restaurant_id))]
        if document_type:
            must.append(
                FieldCondition(key="document_type", match=MatchValue(value=document_type))
            )

        hits = await self._client.search(
            collection_name=self._collection,
            query_vector=[float(x) for x in query_vector.tolist()],
            query_filter=Filter(must=must),
            limit=top_k,
        )

        results: list[tuple[VectorEntry, float]] = []
        for h in hits:
            payload = h.payload or {}
            entry = VectorEntry(
                chunk_id=payload.get("chunk_id", ""),
                document_id=payload.get("document_id", ""),
                restaurant_id=payload.get("restaurant_id", ""),
                vector=np.asarray(h.vector if h.vector is not None else [], dtype=np.float32),
                text=payload.get("text", ""),
                metadata=payload.get("metadata", {}) or {},
            )
            results.append((entry, float(h.score)))
        return results

    async def delete(self, document_id: str, restaurant_id: str) -> int:
        await self._ensure_collection()
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        flt = Filter(
            must=[
                FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                FieldCondition(key="restaurant_id", match=MatchValue(value=restaurant_id)),
            ]
        )
        # Count before delete for an accurate return value
        before = await self._client.count(
            collection_name=self._collection, count_filter=flt, exact=True
        )
        await self._client.delete(collection_name=self._collection, points_selector=flt)
        return int(before.count)

    async def count(self, restaurant_id: str | None = None) -> int:
        await self._ensure_collection()
        if restaurant_id is None:
            res = await self._client.count(collection_name=self._collection, exact=True)
            return int(res.count)
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        flt = Filter(
            must=[FieldCondition(key="restaurant_id", match=MatchValue(value=restaurant_id))]
        )
        res = await self._client.count(
            collection_name=self._collection, count_filter=flt, exact=True
        )
        return int(res.count)

    async def clear(self, restaurant_id: str | None = None) -> None:
        await self._ensure_collection()
        if restaurant_id is None:
            await self._client.delete_collection(self._collection)
            self._ready = False
            return
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        flt = Filter(
            must=[FieldCondition(key="restaurant_id", match=MatchValue(value=restaurant_id))]
        )
        await self._client.delete(collection_name=self._collection, points_selector=flt)


# ------------------------------------------------------------------
# pgvector backend
# ------------------------------------------------------------------


class PgVectorStore(VectorStoreBackend):
    """Persistent vector store backed by PostgreSQL + pgvector.

    Uses a dedicated WRITABLE engine (app.rag.pg_engine) and its own
    ``rag_embeddings`` table. It never writes to AuraOS business tables, so the
    read-only guarantee on the business session (app.config.database) is preserved.
    Multi-tenant isolation is enforced via a ``restaurant_id`` column filter.
    """

    _TABLE = "rag_embeddings"

    def __init__(self) -> None:
        # Validate the optional dependency early with a clear message.
        try:
            import pgvector.sqlalchemy  # noqa: F401
        except ImportError as exc:  # pragma: no cover - exercised only when dep missing
            raise RuntimeError(
                "pgvector is not installed. Install it to use RAG_VECTOR_DB=pgvector: "
                "pip install pgvector"
            ) from exc
        self._dim = settings.RAG_EMBEDDING_DIM
        self._ready = False
        logger.info("Vector store: pgvector (table=%s, dim=%d)", self._TABLE, self._dim)

    async def _ensure_table(self) -> None:
        if self._ready:
            return
        from sqlalchemy import text

        from app.rag.pg_engine import get_rag_session

        async with get_rag_session() as session:
            await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await session.execute(
                text(
                    f"""
                    CREATE TABLE IF NOT EXISTS {self._TABLE} (
                        chunk_id      TEXT PRIMARY KEY,
                        document_id   TEXT NOT NULL,
                        restaurant_id TEXT NOT NULL,
                        document_type TEXT,
                        text          TEXT NOT NULL,
                        metadata      JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                        embedding     vector({self._dim}) NOT NULL
                    )
                    """
                )
            )
            await session.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS {self._TABLE}_restaurant_idx "
                    f"ON {self._TABLE} (restaurant_id)"
                )
            )
            await session.commit()
        self._ready = True

    async def upsert(self, entries: list[VectorEntry]) -> int:
        if not entries:
            return 0
        await self._ensure_table()
        import json

        from sqlalchemy import text

        from app.rag.pg_engine import get_rag_session

        stmt = text(
            f"""
            INSERT INTO {self._TABLE}
                (chunk_id, document_id, restaurant_id, document_type, text, metadata, embedding)
            VALUES
                (:chunk_id, :document_id, :restaurant_id, :document_type, :text,
                 CAST(:metadata AS JSONB), :embedding)
            ON CONFLICT (chunk_id) DO UPDATE SET
                document_id   = EXCLUDED.document_id,
                restaurant_id = EXCLUDED.restaurant_id,
                document_type = EXCLUDED.document_type,
                text          = EXCLUDED.text,
                metadata      = EXCLUDED.metadata,
                embedding     = EXCLUDED.embedding
            """
        )
        async with get_rag_session() as session:
            for e in entries:
                await session.execute(
                    stmt,
                    {
                        "chunk_id": e.chunk_id,
                        "document_id": e.document_id,
                        "restaurant_id": e.restaurant_id,
                        "document_type": e.metadata.get("document_type"),
                        "text": e.text,
                        "metadata": json.dumps(e.metadata),
                        "embedding": "[" + ",".join(str(float(x)) for x in e.vector.tolist()) + "]",
                    },
                )
            await session.commit()
        return len(entries)

    async def search(
        self,
        query_vector: "np.ndarray",
        restaurant_id: str,
        top_k: int = 5,
        document_type: str | None = None,
    ) -> list[tuple[VectorEntry, float]]:
        import numpy as np
        from sqlalchemy import text

        from app.rag.pg_engine import get_rag_session

        await self._ensure_table()

        vec_literal = "[" + ",".join(str(float(x)) for x in query_vector.tolist()) + "]"
        type_clause = "AND document_type = :document_type" if document_type else ""
        stmt = text(
            f"""
            SELECT chunk_id, document_id, restaurant_id, text, metadata,
                   1 - (embedding <=> CAST(:qvec AS vector)) AS score
            FROM {self._TABLE}
            WHERE restaurant_id = :restaurant_id {type_clause}
            ORDER BY embedding <=> CAST(:qvec AS vector) ASC
            LIMIT :top_k
            """
        )
        params: dict = {"qvec": vec_literal, "restaurant_id": restaurant_id, "top_k": top_k}
        if document_type:
            params["document_type"] = document_type

        async with get_rag_session() as session:
            rows = (await session.execute(stmt, params)).mappings().all()

        results: list[tuple[VectorEntry, float]] = []
        for r in rows:
            meta = r["metadata"] or {}
            if isinstance(meta, str):
                import json

                meta = json.loads(meta)
            entry = VectorEntry(
                chunk_id=r["chunk_id"],
                document_id=r["document_id"],
                restaurant_id=r["restaurant_id"],
                vector=np.zeros(0, dtype=np.float32),
                text=r["text"],
                metadata=meta,
            )
            results.append((entry, float(r["score"])))
        return results

    async def delete(self, document_id: str, restaurant_id: str) -> int:
        await self._ensure_table()
        from sqlalchemy import text

        from app.rag.pg_engine import get_rag_session

        stmt = text(
            f"DELETE FROM {self._TABLE} "
            f"WHERE document_id = :document_id AND restaurant_id = :restaurant_id"
        )
        async with get_rag_session() as session:
            result = await session.execute(
                stmt, {"document_id": document_id, "restaurant_id": restaurant_id}
            )
            await session.commit()
        return int(result.rowcount or 0)

    async def count(self, restaurant_id: str | None = None) -> int:
        await self._ensure_table()
        from sqlalchemy import text

        from app.rag.pg_engine import get_rag_session

        if restaurant_id is None:
            stmt = text(f"SELECT COUNT(*) FROM {self._TABLE}")
            params: dict = {}
        else:
            stmt = text(f"SELECT COUNT(*) FROM {self._TABLE} WHERE restaurant_id = :rid")
            params = {"rid": restaurant_id}
        async with get_rag_session() as session:
            value = (await session.execute(stmt, params)).scalar()
        return int(value or 0)

    async def clear(self, restaurant_id: str | None = None) -> None:
        await self._ensure_table()
        from sqlalchemy import text

        from app.rag.pg_engine import get_rag_session

        if restaurant_id is None:
            stmt = text(f"DELETE FROM {self._TABLE}")
            params: dict = {}
        else:
            stmt = text(f"DELETE FROM {self._TABLE} WHERE restaurant_id = :rid")
            params = {"rid": restaurant_id}
        async with get_rag_session() as session:
            await session.execute(stmt, params)
            await session.commit()


# ------------------------------------------------------------------
# Module-level singleton
# ------------------------------------------------------------------

_store: VectorStoreBackend | None = None


def get_vector_store() -> VectorStoreBackend:
    """Return the configured vector store backend.

    Creates the singleton on first call based on settings.RAG_VECTOR_DB.
    Optional backends (qdrant, pgvector) are imported lazily inside their
    classes; if a required dependency is missing the constructor raises a
    clear RuntimeError rather than silently degrading.
    """
    global _store
    if _store is not None:
        return _store

    backend = settings.RAG_VECTOR_DB.lower()

    if backend == "in_memory":
        _store = InMemoryVectorStore()
        logger.info("Vector store: in_memory")
    elif backend == "qdrant":
        _store = QdrantVectorStore()
    elif backend == "pgvector":
        _store = PgVectorStore()
    else:
        logger.warning("Unknown vector DB '%s', using in_memory", backend)
        _store = InMemoryVectorStore()

    return _store


async def reset_vector_store() -> None:
    """Reset the vector store (useful for testing)."""
    global _store
    if _store is not None:
        await _store.clear()
    _store = None