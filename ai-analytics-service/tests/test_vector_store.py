"""Tests for InMemoryVectorStore — Milestone 7.

Covers:
- upsert, search, delete, count, clear
- Multi-tenant isolation via restaurant_id
- Cosine similarity scoring
- Singleton and reset behavior
"""

from __future__ import annotations

import numpy as np
import pytest

from app.rag.vector_store import (
    InMemoryVectorStore,
    VectorEntry,
    get_vector_store,
    reset_vector_store,
)


# Helper: make a normalized random vector of length 384
def _vec(seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed=seed)
    v = rng.random(384, dtype=np.float32)
    return v / np.linalg.norm(v)


class TestInMemoryVectorStore:
    """Unit tests for InMemoryVectorStore."""

    @pytest.mark.asyncio
    async def test_upsert_adds_entries(self) -> None:
        """upsert() should store entries and return count."""
        store = InMemoryVectorStore()
        entries = [
            VectorEntry(
                chunk_id="c1",
                document_id="d1",
                restaurant_id="r1",
                vector=_vec(1),
                text="Hello",
                metadata={"type": "txt"},
            ),
        ]
        count = await store.upsert(entries)
        assert count == 1
        assert await store.count() == 1

    @pytest.mark.asyncio
    async def test_upsert_replaces_existing_chunk_id(self) -> None:
        """upsert() with same chunk_id should replace, not duplicate."""
        store = InMemoryVectorStore()
        entry1 = VectorEntry(
            chunk_id="c1", document_id="d1", restaurant_id="r1",
            vector=_vec(1), text="Hello",
        )
        entry2 = VectorEntry(
            chunk_id="c1", document_id="d1", restaurant_id="r1",
            vector=_vec(2), text="Updated",
        )
        await store.upsert([entry1])
        await store.upsert([entry2])
        assert await store.count() == 1

    @pytest.mark.asyncio
    async def test_search_returns_relevant_results(self) -> None:
        """search() should return results sorted by similarity."""
        store = InMemoryVectorStore()
        base = _vec(1)
        entries = [
            VectorEntry(
                chunk_id=f"c{i}",
                document_id="d1",
                restaurant_id="r1",
                vector=base + np.random.default_rng(i).random(384, dtype=np.float32) * 0.01,
                text=f"Text {i}",
            )
            for i in range(5)
        ]
        await store.upsert(entries)
        results = await store.search(query_vector=base, restaurant_id="r1", top_k=3)
        assert len(results) == 3
        assert results[0][1] >= results[1][1] >= results[2][1]  # descending scores

    @pytest.mark.asyncio
    async def test_search_tenant_isolation(self) -> None:
        """search() should only return results for the given restaurant_id."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c_r1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="R1 text",
            ),
            VectorEntry(
                chunk_id="c_r2", document_id="d2", restaurant_id="r2",
                vector=_vec(2), text="R2 text",
            ),
        ])
        results = await store.search(query_vector=_vec(1), restaurant_id="r1", top_k=10)
        assert len(results) == 1
        assert results[0][0].restaurant_id == "r1"

    @pytest.mark.asyncio
    async def test_search_empty_store_returns_empty(self) -> None:
        """search() on empty store should return []."""
        store = InMemoryVectorStore()
        results = await store.search(query_vector=_vec(1), restaurant_id="r1", top_k=5)
        assert results == []

    @pytest.mark.asyncio
    async def test_search_document_type_filter(self) -> None:
        """search() with document_type filter should only return matching types."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="PDF", metadata={"document_type": "pdf"},
            ),
            VectorEntry(
                chunk_id="c2", document_id="d2", restaurant_id="r1",
                vector=_vec(2), text="TXT", metadata={"document_type": "txt"},
            ),
        ])
        results = await store.search(
            query_vector=_vec(1), restaurant_id="r1", top_k=10, document_type="pdf",
        )
        assert len(results) == 1
        assert results[0][0].metadata["document_type"] == "pdf"

    @pytest.mark.asyncio
    async def test_delete_removes_document_entries(self) -> None:
        """delete() should remove entries for a document and return count."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="D1",
            ),
            VectorEntry(
                chunk_id="c2", document_id="d1", restaurant_id="r1",
                vector=_vec(2), text="D1-2",
            ),
            VectorEntry(
                chunk_id="c3", document_id="d2", restaurant_id="r1",
                vector=_vec(3), text="D2",
            ),
        ])
        deleted = await store.delete(document_id="d1", restaurant_id="r1")
        assert deleted == 2
        assert await store.count() == 1

    @pytest.mark.asyncio
    async def test_delete_wrong_restaurant_does_nothing(self) -> None:
        """delete() with wrong restaurant_id should not remove entries."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="R1",
            ),
        ])
        deleted = await store.delete(document_id="d1", restaurant_id="r2")
        assert deleted == 0
        assert await store.count() == 1

    @pytest.mark.asyncio
    async def test_count_scoped_to_restaurant(self) -> None:
        """count() with restaurant_id should only count matching entries."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="R1",
            ),
            VectorEntry(
                chunk_id="c2", document_id="d2", restaurant_id="r2",
                vector=_vec(2), text="R2",
            ),
        ])
        assert await store.count("r1") == 1
        assert await store.count("r2") == 1
        assert await store.count() == 2

    @pytest.mark.asyncio
    async def test_clear_all_removes_everything(self) -> None:
        """clear() without args should remove all entries."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="R1",
            ),
        ])
        await store.clear()
        assert await store.count() == 0

    @pytest.mark.asyncio
    async def test_clear_scoped_to_restaurant(self) -> None:
        """clear() with restaurant_id should only remove matching entries."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="R1",
            ),
            VectorEntry(
                chunk_id="c2", document_id="d2", restaurant_id="r2",
                vector=_vec(2), text="R2",
            ),
        ])
        await store.clear("r1")
        assert await store.count("r1") == 0
        assert await store.count("r2") == 1

    @pytest.mark.asyncio
    async def test_cosine_similarity_range(self) -> None:
        """Cosine similarity scores should be in [-1, 1]."""
        store = InMemoryVectorStore()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="Test",
            ),
        ])
        results = await store.search(query_vector=_vec(1), restaurant_id="r1", top_k=1)
        score = results[0][1]
        assert -1.0 <= score <= 1.0


class TestVectorStoreSingleton:
    """Tests for the singleton factory and reset."""

    @pytest.mark.asyncio
    async def test_get_vector_store_returns_in_memory(self) -> None:
        """get_vector_store() should return an InMemoryVectorStore by default."""
        await reset_vector_store()
        store = get_vector_store()
        assert isinstance(store, InMemoryVectorStore)

    @pytest.mark.asyncio
    async def test_get_vector_store_returns_singleton(self) -> None:
        """Multiple calls should return the same instance."""
        await reset_vector_store()
        store1 = get_vector_store()
        store2 = get_vector_store()
        assert store1 is store2

    @pytest.mark.asyncio
    async def test_reset_vector_store_clears_data(self) -> None:
        """reset_vector_store() should clear entries and reset singleton."""
        store = get_vector_store()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="Test",
            ),
        ])
        await reset_vector_store()
        store2 = get_vector_store()
        assert await store2.count() == 0


class TestBackendSelection:
    """Tests for get_vector_store() backend selection."""

    @pytest.mark.asyncio
    async def test_default_is_in_memory(self, monkeypatch) -> None:
        """The default RAG_VECTOR_DB should yield an InMemoryVectorStore."""
        from app.config.settings import settings

        await reset_vector_store()
        monkeypatch.setattr(settings, "RAG_VECTOR_DB", "in_memory")
        store = get_vector_store()
        assert isinstance(store, InMemoryVectorStore)
        await reset_vector_store()

    @pytest.mark.asyncio
    async def test_unknown_backend_falls_back_to_in_memory(self, monkeypatch) -> None:
        """An unknown backend name should fall back to in_memory (not crash)."""
        from app.config.settings import settings

        await reset_vector_store()
        monkeypatch.setattr(settings, "RAG_VECTOR_DB", "nonsense")
        store = get_vector_store()
        assert isinstance(store, InMemoryVectorStore)
        await reset_vector_store()

    @pytest.mark.asyncio
    async def test_qdrant_missing_dep_raises_explicitly(self, monkeypatch) -> None:
        """Selecting qdrant without the dependency should raise a clear error, not degrade."""
        import builtins

        from app.config.settings import settings

        await reset_vector_store()
        monkeypatch.setattr(settings, "RAG_VECTOR_DB", "qdrant")

        real_import = builtins.__import__

        def _no_qdrant(name, *args, **kwargs):
            if name.startswith("qdrant_client"):
                raise ImportError("No module named 'qdrant_client'")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", _no_qdrant)
        with pytest.raises(RuntimeError, match="qdrant-client"):
            get_vector_store()
        await reset_vector_store()

    @pytest.mark.asyncio
    async def test_pgvector_missing_dep_raises_explicitly(self, monkeypatch) -> None:
        """Selecting pgvector without the dependency should raise a clear error, not degrade."""
        import builtins

        from app.config.settings import settings

        await reset_vector_store()
        monkeypatch.setattr(settings, "RAG_VECTOR_DB", "pgvector")

        real_import = builtins.__import__

        def _no_pgvector(name, *args, **kwargs):
            if name.startswith("pgvector"):
                raise ImportError("No module named 'pgvector'")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", _no_pgvector)
        with pytest.raises(RuntimeError, match="pgvector"):
            get_vector_store()
        await reset_vector_store()