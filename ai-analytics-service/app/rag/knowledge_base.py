"""Knowledge Base — manages document metadata and storage.

Tracks all ingested documents per restaurant for multi-tenant isolation.
Uses in-memory storage by default; can be extended to PostgreSQL later.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class DocumentRecord:
    """Metadata record for an ingested document."""

    document_id: str
    restaurant_id: str
    filename: str
    document_type: str  # "pdf", "txt", "md"
    chunk_count: int
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = field(default_factory=dict)


class KnowledgeBase:
    """In-memory document metadata store with multi-tenant isolation."""

    def __init__(self) -> None:
        self._documents: dict[str, DocumentRecord] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_document(
        self,
        restaurant_id: str,
        filename: str,
        document_type: str,
        chunk_count: int,
        metadata: dict | None = None,
        document_id: str | None = None,
    ) -> DocumentRecord:
        """Register a new document and return its record."""
        doc_id = document_id or str(uuid.uuid4())
        record = DocumentRecord(
            document_id=doc_id,
            restaurant_id=restaurant_id,
            filename=filename,
            document_type=document_type,
            chunk_count=chunk_count,
            metadata=metadata or {},
        )
        self._documents[doc_id] = record
        logger.info(
            "Document registered: id=%s type=%s chunks=%d restaurant=%s",
            doc_id,
            document_type,
            chunk_count,
            restaurant_id,
        )
        return record

    def get_document(self, document_id: str) -> DocumentRecord | None:
        """Retrieve a document by ID."""
        return self._documents.get(document_id)

    def list_documents(self, restaurant_id: str) -> list[DocumentRecord]:
        """List all documents for a restaurant."""
        return [d for d in self._documents.values() if d.restaurant_id == restaurant_id]

    def delete_document(self, document_id: str, restaurant_id: str) -> bool:
        """Delete a document. Returns True if found and deleted."""
        record = self._documents.get(document_id)
        if record is None or record.restaurant_id != restaurant_id:
            return False
        del self._documents[document_id]
        logger.info("Document deleted: id=%s", document_id)
        return True

    def count(self, restaurant_id: str | None = None) -> int:
        """Return the total number of documents (optionally scoped)."""
        if restaurant_id is None:
            return len(self._documents)
        return sum(1 for d in self._documents.values() if d.restaurant_id == restaurant_id)

    def clear(self, restaurant_id: str | None = None) -> None:
        """Remove all documents (optionally scoped to a restaurant)."""
        if restaurant_id is None:
            self._documents.clear()
        else:
            self._documents = {
                k: v for k, v in self._documents.items() if v.restaurant_id != restaurant_id
            }


# ------------------------------------------------------------------
# Module-level singleton
# ------------------------------------------------------------------

_kb: KnowledgeBase | None = None


def get_knowledge_base() -> KnowledgeBase:
    """Return the global singleton knowledge base."""
    global _kb
    if _kb is None:
        _kb = KnowledgeBase()
    return _kb


async def reset_knowledge_base() -> None:
    """Reset the knowledge base (useful for testing)."""
    global _kb
    if _kb is not None:
        _kb.clear()
    _kb = None