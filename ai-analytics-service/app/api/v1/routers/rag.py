"""RAG router — document upload, search, question answering, and stats.

Endpoints:
    POST   /api/v1/rag/upload   — Upload a document (PDF, TXT, MD)
    GET    /api/v1/rag/search   — Search across documents
    POST   /api/v1/rag/query    — Ask a question with RAG
    GET    /api/v1/rag/stats    — RAG observability metrics
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from app.config.security import CurrentUser, RequireOwnerAdmin
from app.schemas.rag_schemas import (
    QueryRequest,
    QueryResponse,
    RAGStatsResponse,
    SearchResponse,
    UploadError,
    UploadResponse,
)
from app.services.rag_service import (
    answer_question,
    get_rag_stats,
    search_documents,
    upload_document,
)

router = APIRouter(prefix="/rag", tags=["RAG"])

# Maximum file size: 10 MB
_MAX_UPLOAD_SIZE = 10 * 1024 * 1024


# ── Upload ────────────────────────────────────────────────────────────────────


@router.post(
    "/upload",
    response_model=UploadResponse,
    responses={422: {"model": UploadError}},
    summary="Upload a document for RAG",
)
async def upload(
    user: RequireOwnerAdmin,
    file: UploadFile = File(..., description="PDF, TXT, or Markdown file"),
) -> UploadResponse:
    """Upload a document (PDF, TXT, Markdown) to the RAG knowledge base.

    The file is chunked, embedded, and stored for later retrieval.
    Maximum file size: 10 MB. Restricted to OWNER and ADMIN roles.
    """
    # Validate file size
    content = await file.read()
    if len(content) > _MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({len(content)} bytes) exceeds maximum ({_MAX_UPLOAD_SIZE} bytes)",
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is empty",
        )

    try:
        return await upload_document(
            content=content,
            filename=file.filename or "unknown",
            restaurant_id=user.restaurantId,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


# ── Search ────────────────────────────────────────────────────────────────────


@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Search across uploaded documents",
)
async def search(
    user: CurrentUser,
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    top_k: int = Query(default=5, ge=1, le=20, description="Number of results"),
    document_type: str | None = Query(
        default=None,
        description="Filter by document type (pdf, txt, md)",
    ),
) -> SearchResponse:
    """Search across all uploaded documents for the authenticated restaurant.

    Uses hybrid retrieval (vector similarity + keyword matching).
    Results are cached with a configurable TTL.
    """
    try:
        return await search_documents(
            query=q,
            restaurant_id=user.restaurantId,
            top_k=top_k,
            document_type=document_type,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


# ── Question Answering ────────────────────────────────────────────────────────


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Ask a question with RAG-powered answers",
)
async def query(
    user: CurrentUser,
    body: QueryRequest,
) -> QueryResponse:
    """Ask a natural language question and get an AI-generated answer
    backed by your uploaded documents.

    The pipeline: retrieve → build context → generate answer → cite sources.
    Uses the configured LLM provider (Gemini, OpenAI, DeepSeek, or Mock).
    """
    try:
        return await answer_question(
            request=body,
            restaurant_id=user.restaurantId,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


# ── Stats ─────────────────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=RAGStatsResponse,
    summary="RAG observability metrics",
)
async def stats(
    user: CurrentUser,
) -> RAGStatsResponse:
    """Return RAG system metrics including document count, chunk count,
    queries served, average latency, cache hit rate, and provider info.
    """
    return await get_rag_stats()