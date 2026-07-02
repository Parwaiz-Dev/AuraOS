"""Retriever — hybrid retrieval combining vector similarity and keyword search.

Uses weighted scoring to rank results:
- Vector similarity score (cosine) — weight 0.7
- Keyword match score (BM25-like) — weight 0.3

All retrieval is scoped by restaurant_id for multi-tenant isolation.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """A single retrieval result with hybrid scoring."""

    chunk_id: str
    document_id: str
    text: str
    vector_score: float
    keyword_score: float
    combined_score: float
    metadata: dict = field(default_factory=dict)


class HybridRetriever:
    """Retrieves relevant chunks using vector + keyword hybrid search."""

    def __init__(self) -> None:
        self._vector_weight = 0.7
        self._keyword_weight = 0.3

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def retrieve(
        self,
        query: str,
        restaurant_id: str,
        top_k: int | None = None,
        document_type: str | None = None,
    ) -> list[RetrievalResult]:
        """Retrieve the top_k most relevant chunks for a query.

        Args:
            query: The search query text.
            restaurant_id: Scoped tenant ID.
            top_k: Number of results to return (default from settings).
            document_type: Optional filter by document type.

        Returns:
            List of RetrievalResult sorted by combined_score descending.
        """
        top_k = top_k or settings.RAG_TOP_K

        # 1. Generate query embedding
        from app.rag.embeddings import get_embedding_model

        model = get_embedding_model()
        query_vector = await model.embed_single(query)

        # 2. Vector search
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        vector_results = await store.search(
            query_vector=query_vector,
            restaurant_id=restaurant_id,
            top_k=top_k * 3,  # Over-fetch for re-ranking
            document_type=document_type,
        )

        if not vector_results:
            return []

        # 3. Compute keyword scores
        query_tokens = self._tokenize(query)

        results: list[RetrievalResult] = []
        for entry, vec_score in vector_results:
            kw_score = self._keyword_score(query_tokens, entry.text)
            combined = (self._vector_weight * vec_score) + (self._keyword_weight * kw_score)
            results.append(
                RetrievalResult(
                    chunk_id=entry.chunk_id,
                    document_id=entry.document_id,
                    text=entry.text,
                    vector_score=vec_score,
                    keyword_score=kw_score,
                    combined_score=combined,
                    metadata=entry.metadata,
                )
            )

        # 4. Sort by combined score and return top_k
        results.sort(key=lambda r: r.combined_score, reverse=True)
        return results[:top_k]

    # ------------------------------------------------------------------
    # Keyword scoring
    # ------------------------------------------------------------------

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Lowercase tokenization."""
        return re.findall(r"\w+", text.lower())

    @staticmethod
    def _keyword_score(query_tokens: list[str], doc_text: str) -> float:
        """Simple TF-based keyword match score (0-1)."""
        if not query_tokens:
            return 0.0

        doc_lower = doc_text.lower()
        doc_tokens = set(re.findall(r"\w+", doc_lower))
        if not doc_tokens:
            return 0.0

        matches = sum(1 for t in query_tokens if t in doc_tokens)
        # Jaccard-like normalization
        return matches / len(set(query_tokens) | doc_tokens)


# ------------------------------------------------------------------
# Module-level convenience
# ------------------------------------------------------------------

_retriever: HybridRetriever | None = None


def get_retriever() -> HybridRetriever:
    """Return the global singleton retriever."""
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever()
    return _retriever