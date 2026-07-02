"""RAG tool — wraps the RAG service for document retrieval (SOPs, recipes, policies)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def rag_tool(restaurant_id: str, query: str, *, top_k: int = 5) -> dict[str, Any]:
    """Retrieve relevant document chunks for a query.

    Unlike the other tools, RAG does not use the business DB session — it queries
    the vector store via the existing RAG service. Returns matched chunks with
    their source citations.
    """
    from app.services.rag_service import search_documents

    try:
        response = await search_documents(query=query, restaurant_id=restaurant_id, top_k=top_k)
    except Exception:
        logger.debug("rag_tool: search failed", exc_info=True)
        return {"results": [], "total": 0}

    return {
        "total": response.total,
        "results": [
            {
                "text": r.text,
                "document_type": r.document_type,
                "document_id": r.document_id,
                "score": r.score,
            }
            for r in response.results[:top_k]
        ],
    }
