"""Document Repository — tracks uploaded documents for RAG.

This is a lightweight in-memory tracker since we do NOT write to the
AuraOS Core database.  It provides document metadata for the RAG service
layer and stats endpoint.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.rag.knowledge_base import get_knowledge_base

if TYPE_CHECKING:
    from app.rag.knowledge_base import DocumentRecord

logger = logging.getLogger(__name__)


async def fetch_documents(restaurant_id: str) -> list["DocumentRecord"]:
    """List all documents for a restaurant."""
    kb = get_knowledge_base()
    return kb.list_documents(restaurant_id)


async def fetch_document(document_id: str) -> "DocumentRecord | None":
    """Get a single document by ID."""
    kb = get_knowledge_base()
    return kb.get_document(document_id)


async def count_documents(restaurant_id: str | None = None) -> int:
    """Count documents (optionally scoped to a restaurant)."""
    kb = get_knowledge_base()
    return kb.count(restaurant_id)


async def delete_document(document_id: str, restaurant_id: str) -> bool:
    """Delete a document and its chunks."""
    from app.rag.ingestion_service import get_ingestion_service

    ingestion = get_ingestion_service()
    return await ingestion.delete_document(document_id, restaurant_id)