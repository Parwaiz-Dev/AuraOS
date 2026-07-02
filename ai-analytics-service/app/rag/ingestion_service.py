"""Ingestion Service — orchestrates the full document ingestion pipeline.

Pipeline: load → chunk → embed → store → register metadata.

This is the primary entry point for document uploads.  It coordinates
the DocumentLoader, TextChunker, EmbeddingModel, VectorStore, and
KnowledgeBase into a single async workflow.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.rag.chunker import TextChunker
from app.rag.document_loader import DocumentLoader, get_document_loader
from app.rag.embeddings import EmbeddingModel, get_embedding_model
from app.rag.knowledge_base import KnowledgeBase, get_knowledge_base
from app.rag.vector_store import VectorEntry, get_vector_store, reset_vector_store
from app.schemas.rag_schemas import UploadResponse

if TYPE_CHECKING:
    from app.rag.vector_store import VectorStoreBackend

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates document ingestion: load → chunk → embed → store."""

    def __init__(
        self,
        loader: DocumentLoader | None = None,
        chunker: TextChunker | None = None,
        embedder: EmbeddingModel | None = None,
        store: "VectorStoreBackend | None" = None,
        kb: KnowledgeBase | None = None,
    ) -> None:
        self._loader = loader or get_document_loader()
        self._chunker = chunker or TextChunker()
        self._embedder = embedder or get_embedding_model()
        self._store = store or get_vector_store()
        self._kb = kb or get_knowledge_base()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def ingest(
        self,
        content: bytes,
        filename: str,
        restaurant_id: str,
    ) -> UploadResponse:
        """Ingest a document into the RAG system.

        Args:
            content: Raw file bytes.
            filename: Original filename.
            restaurant_id: Tenant identifier for multi-tenant isolation.

        Returns:
            UploadResponse with document_id, chunk count, filename, and type.

        Raises:
            ValueError: If the file is empty, unsupported, or has no extractable text.
        """
        if not settings.RAG_ENABLED:
            raise RuntimeError("RAG is disabled — set RAG_ENABLED=true in settings")

        t0 = time.perf_counter()

        # 1. Load text from file
        text, doc_type = await self._loader.load(content, filename)
        logger.info("Loaded %d chars from %s (type=%s)", len(text), filename, doc_type)

        # 2. Chunk the text
        chunks = self._chunker.chunk(text=text, document_id="", metadata={"document_type": doc_type})
        if not chunks:
            raise ValueError(f"No chunks generated from {filename}")

        # 3. Register document in knowledge base to get a document_id
        record = self._kb.add_document(
            restaurant_id=restaurant_id,
            filename=filename,
            document_type=doc_type,
            chunk_count=len(chunks),
        )
        document_id = record.document_id

        # 4. Re-chunk with the real document_id (since we now have it)
        chunks = self._chunker.chunk(
            text=text,
            document_id=document_id,
            metadata={"document_type": doc_type, "filename": filename},
        )

        # 5. Generate embeddings
        chunk_texts = [c.text for c in chunks]
        vectors = await self._embedder.embed(chunk_texts)

        # 6. Store in vector DB
        entries: list[VectorEntry] = []
        for chunk, vector in zip(chunks, vectors):
            entries.append(
                VectorEntry(
                    chunk_id=chunk.chunk_id,
                    document_id=document_id,
                    restaurant_id=restaurant_id,
                    vector=vector,
                    text=chunk.text,
                    metadata=chunk.metadata,
                )
            )

        stored = await self._store.upsert(entries)
        logger.info("Stored %d vectors for document %s", stored, document_id)

        elapsed = (time.perf_counter() - t0) * 1000
        logger.info("Ingestion complete: %s in %.1f ms", document_id, elapsed)

        return UploadResponse(
            document_id=document_id,
            chunks=len(chunks),
            filename=filename,
            document_type=doc_type,
        )

    async def delete_document(self, document_id: str, restaurant_id: str) -> bool:
        """Delete a document and all its chunks."""
        deleted_kb = self._kb.delete_document(document_id, restaurant_id)
        deleted_vs = await self._store.delete(document_id, restaurant_id)
        logger.info(
            "Deleted document %s: kb=%s vs=%d",
            document_id,
            deleted_kb,
            deleted_vs,
        )
        return deleted_kb or deleted_vs > 0

    async def clear_all(self, restaurant_id: str | None = None) -> None:
        """Clear all documents and vectors (optionally scoped)."""
        self._kb.clear(restaurant_id)
        await self._store.clear(restaurant_id)
        await reset_vector_store()
        logger.info("Cleared all RAG data (restaurant=%s)", restaurant_id or "all")


# ------------------------------------------------------------------
# Module-level convenience
# ------------------------------------------------------------------

_ingestion: IngestionService | None = None


def get_ingestion_service() -> IngestionService:
    """Return the global singleton ingestion service."""
    global _ingestion
    if _ingestion is None:
        _ingestion = IngestionService()
    return _ingestion