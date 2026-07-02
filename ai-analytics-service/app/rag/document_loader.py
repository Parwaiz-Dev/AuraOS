"""Document Loader — loads PDF, TXT, and Markdown files.

Extracts raw text from uploaded documents for downstream chunking and embedding.
Uses PyPDF2 for PDF files and UTF-8 for plain text formats.
"""

from __future__ import annotations

import io
import logging
import os

logger = logging.getLogger(__name__)

# Supported MIME types and their corresponding document types
_SUPPORTED_EXTENSIONS: dict[str, str] = {
    ".pdf": "pdf",
    ".txt": "txt",
    ".md": "md",
    ".markdown": "md",
    ".text": "txt",
}


class DocumentLoader:
    """Loads and extracts text from various document formats."""

    # Allowed file size: 10 MB
    MAX_FILE_SIZE: int = 10 * 1024 * 1024

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def load(
        self,
        content: bytes,
        filename: str,
    ) -> tuple[str, str]:
        """Load text from raw file bytes.

        Args:
            content: Raw file bytes.
            filename: Original filename (used to detect type).

        Returns:
            Tuple of (extracted_text, document_type).

        Raises:
            ValueError: If the file type is unsupported or content is empty.
        """
        if not content:
            raise ValueError("File content is empty")

        if len(content) > self.MAX_FILE_SIZE:
            raise ValueError(
                f"File size ({len(content)} bytes) exceeds maximum ({self.MAX_FILE_SIZE} bytes)"
            )

        doc_type = self._detect_type(filename)
        logger.info("Loading document: %s (type=%s, size=%d bytes)", filename, doc_type, len(content))

        if doc_type == "pdf":
            text = self._load_pdf(content)
        elif doc_type in ("txt", "md"):
            text = self._load_text(content)
        else:
            raise ValueError(f"Unsupported document type: {doc_type}")

        if not text or not text.strip():
            raise ValueError(f"No extractable text found in {filename}")

        return text, doc_type

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_type(filename: str) -> str:
        """Detect document type from file extension."""
        ext = os.path.splitext(filename)[1].lower()
        return _SUPPORTED_EXTENSIONS.get(ext, "unknown")

    @staticmethod
    def _load_text(content: bytes) -> str:
        """Load plain text (TXT, Markdown) from bytes."""
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            # Try with common fallback encodings
            for enc in ("latin-1", "cp1252", "iso-8859-1"):
                try:
                    return content.decode(enc)
                except UnicodeDecodeError:
                    continue
            raise ValueError("Unable to decode text file — unsupported encoding")

    @staticmethod
    def _load_pdf(content: bytes) -> str:
        """Extract text from a PDF file using PyPDF2."""
        try:
            from PyPDF2 import PdfReader
        except ImportError:
            raise ImportError(
                "PyPDF2 is required for PDF support. Install it with: pip install PyPDF2"
            )

        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF files are not supported")

        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)

        return "\n\n".join(pages)


def get_document_loader() -> DocumentLoader:
    """Return a new DocumentLoader instance."""
    return DocumentLoader()