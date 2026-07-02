"""Text Chunker — splits documents into overlapping token windows.

Uses a simple whitespace-based tokenizer for portability (no heavy NLP
dependency required).  Chunk size and overlap are configurable via settings.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A single text chunk from a document."""

    chunk_id: str
    document_id: str
    chunk_index: int
    text: str
    token_count: int
    metadata: dict = field(default_factory=dict)


class TextChunker:
    """Splits text into overlapping chunks by approximate token count."""

    def __init__(
        self,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
    ) -> None:
        self._chunk_size = chunk_size or settings.RAG_CHUNK_SIZE
        self._chunk_overlap = chunk_overlap or settings.RAG_CHUNK_OVERLAP

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk(
        self,
        text: str,
        document_id: str,
        metadata: dict | None = None,
    ) -> list[Chunk]:
        """Split *text* into overlapping chunks.

        Returns an empty list when *text* is empty/whitespace-only.
        """
        if not text or not text.strip():
            logger.warning("Empty text passed to chunker for document=%s", document_id)
            return []

        tokens = self._tokenize(text)
        if not tokens:
            return []

        chunks: list[Chunk] = []
        step = max(1, self._chunk_size - self._chunk_overlap)
        idx = 0

        while idx < len(tokens):
            window = tokens[idx : idx + self._chunk_size]
            chunk_text = " ".join(window)
            chunk = Chunk(
                chunk_id=f"{document_id}_chunk_{len(chunks)}",
                document_id=document_id,
                chunk_index=len(chunks),
                text=chunk_text,
                token_count=len(window),
                metadata=metadata or {},
            )
            chunks.append(chunk)
            idx += step

        logger.debug(
            "Chunked document=%s into %d chunks (size=%d, overlap=%d)",
            document_id,
            len(chunks),
            self._chunk_size,
            self._chunk_overlap,
        )
        return chunks

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Simple whitespace + punctuation-aware tokenizer."""
        # Normalize whitespace
        cleaned = re.sub(r"\s+", " ", text).strip()
        # Split on word boundaries, keeping punctuation as separate tokens
        return re.findall(r"\w+(?:'\w+)?|[^\w\s]", cleaned)