"""Citation Builder — builds citation metadata for RAG responses.

Every answer must include source document, chunk ID, and confidence score.
This module extracts and formats citation information from retrieval results.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.rag.retriever import RetrievalResult

logger = logging.getLogger(__name__)


@dataclass
class Citation:
    """A citation linking an answer to source documents."""

    document_id: str
    document_type: str
    chunk_id: str
    text: str
    confidence: float  # 0.0 - 1.0
    metadata: dict = field(default_factory=dict)


class CitationBuilder:
    """Builds citation objects from retrieval results."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_citations(
        self,
        results: list[RetrievalResult],
        max_citations: int = 5,
    ) -> list[Citation]:
        """Build citations from retrieval results.

        Filters out low-confidence results and deduplicates by document_id.
        """
        if not results:
            return []

        citations: list[Citation] = []
        seen_docs: set[str] = set()

        for result in results:
            if result.combined_score < 0.1:  # Skip very low relevance
                continue

            if result.document_id in seen_docs:
                continue

            seen_docs.add(result.document_id)

            doc_type = result.metadata.get("document_type", "unknown")
            citations.append(
                Citation(
                    document_id=result.document_id,
                    document_type=doc_type,
                    chunk_id=result.chunk_id,
                    text=result.text[:300],  # Truncate for citation
                    confidence=round(result.combined_score, 4),
                    metadata=result.metadata,
                )
            )

            if len(citations) >= max_citations:
                break

        return citations

    def build_context_string(self, results: list[RetrievalResult], max_chunks: int = 5) -> str:
        """Build a compact context string from retrieval results for LLM prompts.

        Format:
            [Source: {document_type}] {text}
            ---
        """
        if not results:
            return "No relevant documents found."

        lines: list[str] = []
        for i, result in enumerate(results[:max_chunks]):
            doc_type = result.metadata.get("document_type", "unknown")
            lines.append(f"[Source: {doc_type}] {result.text}")
            if i < min(len(results), max_chunks) - 1:
                lines.append("---")

        return "\n".join(lines)


# ------------------------------------------------------------------
# Module-level convenience
# ------------------------------------------------------------------

_citation_builder: CitationBuilder | None = None


def get_citation_builder() -> CitationBuilder:
    """Return the global singleton citation builder."""
    global _citation_builder
    if _citation_builder is None:
        _citation_builder = CitationBuilder()
    return _citation_builder