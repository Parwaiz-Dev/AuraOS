"""Tests for HybridRetriever — Milestone 7.

Covers:
- retrieve() with empty store returns empty
- retrieve() with populated store returns results
- Hybrid scoring (vector + keyword)
- Keyword scoring helper
- Multi-tenant isolation
- Singleton get_retriever()
"""

from __future__ import annotations

import numpy as np
import pytest

from app.rag.retriever import (
    HybridRetriever,
    RetrievalResult,
    get_retriever,
)
from app.rag.vector_store import (
    InMemoryVectorStore,
    VectorEntry,
    reset_vector_store,
)


def _vec(seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed=seed)
    v = rng.random(384, dtype=np.float32)
    return v / np.linalg.norm(v)


class TestHybridRetriever:
    """Unit tests for HybridRetriever."""

    @pytest.mark.asyncio
    async def test_retrieve_empty_store_returns_empty(self) -> None:
        """retrieve() should return [] when the store is empty."""
        await reset_vector_store()
        retriever = HybridRetriever()
        results = await retriever.retrieve(
            query="test query",
            restaurant_id="r1",
            top_k=5,
        )
        assert results == []

    @pytest.mark.asyncio
    async def test_retrieve_returns_results(self) -> None:
        """retrieve() should return scored results from a populated store."""
        await reset_vector_store()
        # Populate the vector store directly
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        base = _vec(1)
        await store.upsert([
            VectorEntry(
                chunk_id="c1",
                document_id="d1",
                restaurant_id="r1",
                vector=base,
                text="The quick brown fox jumps over the lazy dog",
                metadata={"document_type": "txt", "filename": "test.txt"},
            ),
            VectorEntry(
                chunk_id="c2",
                document_id="d2",
                restaurant_id="r1",
                vector=_vec(2),
                text="Python is a great programming language",
                metadata={"document_type": "md", "filename": "test.md"},
            ),
        ])

        retriever = HybridRetriever()
        results = await retriever.retrieve(
            query="quick brown fox",
            restaurant_id="r1",
            top_k=2,
        )
        assert len(results) == 2
        assert all(isinstance(r, RetrievalResult) for r in results)
        assert results[0].combined_score >= results[1].combined_score

    @pytest.mark.asyncio
    async def test_retrieve_tenant_isolation(self) -> None:
        """retrieve() should only return results for the given restaurant."""
        await reset_vector_store()
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        await store.upsert([
            VectorEntry(
                chunk_id="c_r1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="R1 document",
                metadata={"document_type": "txt"},
            ),
            VectorEntry(
                chunk_id="c_r2", document_id="d2", restaurant_id="r2",
                vector=_vec(2), text="R2 document",
                metadata={"document_type": "txt"},
            ),
        ])

        retriever = HybridRetriever()
        results = await retriever.retrieve(
            query="document",
            restaurant_id="r1",
            top_k=5,
        )
        # All results should belong to r1
        assert all(r.metadata.get("document_type") == "txt" for r in results)
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_retrieve_document_type_filter(self) -> None:
        """retrieve() with document_type filter should only return matching types."""
        await reset_vector_store()
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="PDF content", metadata={"document_type": "pdf"},
            ),
            VectorEntry(
                chunk_id="c2", document_id="d2", restaurant_id="r1",
                vector=_vec(2), text="MD content", metadata={"document_type": "md"},
            ),
        ])

        retriever = HybridRetriever()
        results = await retriever.retrieve(
            query="content",
            restaurant_id="r1",
            top_k=5,
            document_type="pdf",
        )
        assert len(results) == 1
        assert results[0].metadata["document_type"] == "pdf"

    @pytest.mark.asyncio
    async def test_retrieve_respects_top_k(self) -> None:
        """retrieve() should return at most top_k results."""
        await reset_vector_store()
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        entries = [
            VectorEntry(
                chunk_id=f"c{i}", document_id="d1", restaurant_id="r1",
                vector=_vec(i), text=f"Document {i}",
                metadata={"document_type": "txt"},
            )
            for i in range(10)
        ]
        await store.upsert(entries)

        retriever = HybridRetriever()
        results = await retriever.retrieve(query="Document", restaurant_id="r1", top_k=3)
        assert len(results) <= 3

    @pytest.mark.asyncio
    async def test_retrieve_combined_score_in_range(self) -> None:
        """Combined scores should be in [0, 1] range."""
        await reset_vector_store()
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        await store.upsert([
            VectorEntry(
                chunk_id="c1", document_id="d1", restaurant_id="r1",
                vector=_vec(1), text="Sample text", metadata={"document_type": "txt"},
            ),
        ])

        retriever = HybridRetriever()
        results = await retriever.retrieve(query="Sample", restaurant_id="r1", top_k=5)
        assert len(results) > 0
        for r in results:
            assert 0.0 <= r.combined_score <= 1.0


class TestKeywordScoring:
    """Unit tests for keyword scoring helpers."""

    def test_tokenize_splits_words(self) -> None:
        """_tokenize() should split on word boundaries."""
        tokens = HybridRetriever._tokenize("Hello, world! How are you?")
        assert "hello" in tokens
        assert "world" in tokens
        assert "how" in tokens
        assert "are" in tokens
        assert "you" in tokens

    def test_tokenize_lowercases(self) -> None:
        """_tokenize() should lowercase all tokens."""
        tokens = HybridRetriever._tokenize("HELLO WORLD")
        assert tokens == ["hello", "world"]

    def test_keyword_score_perfect_match(self) -> None:
        """_keyword_score() should give high score for matching tokens."""
        query_tokens = ["hello", "world"]
        score = HybridRetriever._keyword_score(query_tokens, "hello world")
        assert score > 0.0

    def test_keyword_score_no_match(self) -> None:
        """_keyword_score() should give 0.0 for no matches."""
        query_tokens = ["xyz", "abc"]
        score = HybridRetriever._keyword_score(query_tokens, "hello world")
        assert score == 0.0

    def test_keyword_score_empty_query(self) -> None:
        """_keyword_score() should return 0.0 for empty query tokens."""
        score = HybridRetriever._keyword_score([], "hello world")
        assert score == 0.0

    def test_keyword_score_empty_doc(self) -> None:
        """_keyword_score() should return 0.0 for empty doc text."""
        score = HybridRetriever._keyword_score(["hello"], "")
        assert score == 0.0

    def test_keyword_score_partial_match(self) -> None:
        """_keyword_score() should give partial score for partial matches."""
        query_tokens = ["hello", "xyz"]
        score = HybridRetriever._keyword_score(query_tokens, "hello world")
        assert 0.0 < score < 1.0


class TestGetRetriever:
    """Tests for the singleton factory."""

    def test_get_retriever_returns_singleton(self) -> None:
        """Multiple calls should return the same instance."""
        r1 = get_retriever()
        r2 = get_retriever()
        assert r1 is r2

    def test_get_retriever_returns_hybrid_retriever(self) -> None:
        """Should return a HybridRetriever instance."""
        retriever = get_retriever()
        assert isinstance(retriever, HybridRetriever)