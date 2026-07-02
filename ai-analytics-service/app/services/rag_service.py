"""RAG Service — orchestrates the full RAG pipeline.

Exposes three primary operations:
- upload: ingest a document (load → chunk → embed → store)
- search: hybrid retrieval with caching
- query: full RAG Q&A (retrieve → build context → generate → cite)

Also tracks observability metrics (latency, hit rate, query count).
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings
from app.rag.citation_builder import get_citation_builder
from app.rag.ingestion_service import get_ingestion_service
from app.rag.model_manager import get_model_manager
from app.rag.retriever import get_retriever
from app.schemas.rag_schemas import (
    Citation,
    QueryRequest,
    QueryResponse,
    RAGStatsResponse,
    SearchResponse,
    SearchResult,
    UploadResponse,
)

if TYPE_CHECKING:
    from app.rag.retriever import RetrievalResult

logger = logging.getLogger(__name__)

# ── Observability metrics (Redis-backed, in-memory fallback) ───────────────────

_METRICS_KEY = "rag:metrics:global"

_metrics: dict[str, int | float] = {
    "queries_served": 0,
    "total_latency_ms": 0.0,
    "cache_hits": 0,
    "cache_misses": 0,
}


async def _load_metrics() -> dict[str, int | float]:
    """Load metrics from Redis, falling back to the in-memory copy."""
    try:
        if await is_redis_available():
            stored = await cache_get(_METRICS_KEY)
            if isinstance(stored, dict):
                # Keep the in-memory mirror in sync for graceful degradation.
                _metrics.update(stored)
    except Exception:
        logger.debug("Failed to load RAG metrics from Redis", exc_info=True)
    return _metrics


async def _save_metrics() -> None:
    """Persist the current metrics to Redis (best-effort)."""
    try:
        if await is_redis_available():
            # No TTL: metrics are long-lived counters.
            await cache_set(_METRICS_KEY, dict(_metrics), ttl=10 * 365 * 24 * 3600)
    except Exception:
        logger.debug("Failed to persist RAG metrics to Redis", exc_info=True)


# ── Upload ────────────────────────────────────────────────────────────────────


async def upload_document(
    content: bytes,
    filename: str,
    restaurant_id: str,
) -> UploadResponse:
    """Ingest a document into the RAG system."""
    if not settings.RAG_ENABLED:
        raise RuntimeError("RAG is disabled")

    ingestion = get_ingestion_service()
    result = await ingestion.ingest(content, filename, restaurant_id)

    # Milestone 8: Publish DocumentUploaded event
    try:
        from app.events.domain_events import DocumentUploaded
        from app.events.publisher import publish

        await publish(DocumentUploaded(
            restaurant_id=restaurant_id,
            document_id=result.document_id,
            filename=filename,
            chunks=result.chunks,
        ))
    except Exception:
        logger.debug("Failed to publish DocumentUploaded event", exc_info=True)

    return result


# ── Search ────────────────────────────────────────────────────────────────────


async def search_documents(
    query: str,
    restaurant_id: str,
    top_k: int | None = None,
    document_type: str | None = None,
) -> SearchResponse:
    """Search for relevant chunks across all documents."""
    if not settings.RAG_ENABLED:
        raise RuntimeError("RAG is disabled")

    top_k = top_k or settings.RAG_TOP_K
    t0 = time.perf_counter()

    await _load_metrics()

    # Check cache
    cache_key = _build_cache_key("search", query, restaurant_id, top_k, document_type)
    cached = await _cache_get_json(cache_key)
    if cached is not None:
        _metrics["cache_hits"] = int(_metrics["cache_hits"]) + 1
        await _save_metrics()
        elapsed = (time.perf_counter() - t0) * 1000
        cached["latency_ms"] = round(elapsed, 2)
        return SearchResponse(**cached)

    _metrics["cache_misses"] = int(_metrics["cache_misses"]) + 1
    await _save_metrics()

    retriever = get_retriever()
    results = await retriever.retrieve(
        query=query,
        restaurant_id=restaurant_id,
        top_k=top_k,
        document_type=document_type,
    )

    search_results = [
        SearchResult(
            chunk_id=r.chunk_id,
            document_id=r.document_id,
            document_type=r.metadata.get("document_type", ""),
            text=r.text,
            score=round(r.combined_score, 4),
            metadata=r.metadata,
        )
        for r in results
    ]

    elapsed = (time.perf_counter() - t0) * 1000
    response = SearchResponse(
        query=query,
        results=search_results,
        total=len(search_results),
        latency_ms=round(elapsed, 2),
    )

    # Cache the response
    await _cache_set_json(cache_key, response.model_dump())

    return response


# ── Question Answering ────────────────────────────────────────────────────────


async def answer_question(
    request: QueryRequest,
    restaurant_id: str,
    conversation_history: str | None = None,
) -> QueryResponse:
    """Full RAG Q&A pipeline: retrieve → build context → generate → cite."""
    if not settings.RAG_ENABLED:
        raise RuntimeError("RAG is disabled")

    t0 = time.perf_counter()

    await _load_metrics()

    # 1. Retrieve relevant chunks
    retriever = get_retriever()
    results = await retriever.retrieve(
        query=request.question,
        restaurant_id=restaurant_id,
        top_k=request.top_k,
    )

    # 2. Build context string
    builder = get_citation_builder()
    context = builder.build_context_string(results, max_chunks=request.top_k)

    # 3. Build citations
    citations_raw = builder.build_citations(results, max_citations=request.top_k)
    citations = [
        Citation(
            document_id=c.document_id,
            document_type=c.document_type,
            chunk_id=c.chunk_id,
            text=c.text,
            confidence=c.confidence,
        )
        for c in citations_raw
    ]

    # 4. Generate answer using LLM
    model_mgr = get_model_manager()
    rag_answer = await model_mgr.generate_answer(
        question=request.question,
        context=context,
        conversation_history=conversation_history,
    )

    elapsed = (time.perf_counter() - t0) * 1000

    # Update metrics
    _metrics["queries_served"] = int(_metrics["queries_served"]) + 1
    _metrics["total_latency_ms"] = float(_metrics["total_latency_ms"]) + elapsed
    await _save_metrics()

    return QueryResponse(
        question=request.question,
        answer=rag_answer.answer,
        sources=citations,
        provider=rag_answer.provider,
        latency_ms=round(elapsed, 2),
        token_usage=rag_answer.token_usage,
    )


# ── Stats ─────────────────────────────────────────────────────────────────────


async def get_rag_stats() -> RAGStatsResponse:
    """Return RAG observability metrics."""
    from app.rag.knowledge_base import get_knowledge_base
    from app.rag.vector_store import get_vector_store

    kb = get_knowledge_base()
    store = get_vector_store()

    await _load_metrics()

    total_queries = int(_metrics["queries_served"])
    avg_latency = (
        float(_metrics["total_latency_ms"]) / total_queries if total_queries > 0 else 0.0
    )

    total_cache = int(_metrics["cache_hits"]) + int(_metrics["cache_misses"])
    hit_rate = (
        int(_metrics["cache_hits"]) / total_cache if total_cache > 0 else 0.0
    )

    return RAGStatsResponse(
        documents=kb.count(),
        chunks=await store.count(),
        queries_served=total_queries,
        average_latency_ms=round(avg_latency, 2),
        hit_rate=round(hit_rate, 4),
        provider=settings.COPILOT_PROVIDER,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _build_cache_key(*parts: str | int | None) -> str:
    """Build a deterministic cache key from parts."""
    raw = "|".join(str(p) for p in parts if p is not None)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"rag:{digest}"


async def _cache_get_json(key: str) -> dict | None:
    """Get a cached JSON value, returning None on miss or error."""
    import json

    try:
        if not await is_redis_available():
            return None
        raw = await cache_get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.debug("Cache get failed for key=%s", key, exc_info=True)
        return None


async def _cache_set_json(key: str, value: dict) -> None:
    """Set a cache key with the RAG TTL."""
    import json

    try:
        if not await is_redis_available():
            return
        await cache_set(key, json.dumps(value), ttl=settings.RAG_CACHE_TTL)
    except Exception:
        logger.debug("Cache set failed for key=%s", key, exc_info=True)