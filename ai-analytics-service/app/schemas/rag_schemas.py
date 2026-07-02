"""RAG schemas — request/response models for Milestone 7.

Document upload, search, question answering, and stats endpoints.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Document Upload ─────────────────────────────────────────────────────────


class UploadResponse(BaseModel):
    """Response from POST /api/v1/rag/upload."""

    document_id: str = Field(..., description="Unique document identifier")
    chunks: int = Field(..., description="Number of chunks created")
    filename: str = Field(default="", description="Original filename")
    document_type: str = Field(default="", description="Detected document type")


class UploadError(BaseModel):
    """Error response for upload failures."""

    detail: str = Field(..., description="Error description")
    filename: str = Field(default="", description="Original filename")


# ── Search ──────────────────────────────────────────────────────────────────


class SearchResult(BaseModel):
    """A single search result chunk."""

    chunk_id: str = Field(..., description="Unique chunk identifier")
    document_id: str = Field(..., description="Parent document ID")
    document_type: str = Field(default="", description="Document type")
    text: str = Field(..., description="Matching chunk text")
    score: float = Field(..., description="Relevance score")
    metadata: dict = Field(default_factory=dict, description="Chunk metadata")


class SearchResponse(BaseModel):
    """Response from GET /api/v1/rag/search."""

    query: str = Field(..., description="Original search query")
    results: list[SearchResult] = Field(default_factory=list)
    total: int = Field(default=0, description="Total results found")
    latency_ms: float = Field(default=0.0, description="Search latency in ms")


# ── Question Answering ──────────────────────────────────────────────────────


class QueryRequest(BaseModel):
    """Request body for POST /api/v1/rag/query."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural language question to answer",
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of chunks to retrieve",
    )


class Citation(BaseModel):
    """A citation linking an answer to a source document."""

    document_id: str = Field(..., description="Source document ID")
    document_type: str = Field(default="", description="Document type")
    chunk_id: str = Field(..., description="Specific chunk ID")
    text: str = Field(default="", description="Relevant excerpt from source")
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Citation confidence score",
    )


class QueryResponse(BaseModel):
    """Response from POST /api/v1/rag/query."""

    question: str = Field(..., description="Original question")
    answer: str = Field(..., description="Generated answer")
    sources: list[Citation] = Field(default_factory=list)
    provider: str = Field(default="mock", description="LLM provider used")
    latency_ms: float = Field(default=0.0, description="Total query latency in ms")
    token_usage: int = Field(default=0, description="Approximate tokens used")


# ── Stats ───────────────────────────────────────────────────────────────────


class RAGStatsResponse(BaseModel):
    """Response from GET /api/v1/rag/stats."""

    documents: int = Field(default=0, description="Total documents ingested")
    chunks: int = Field(default=0, description="Total chunks stored")
    queries_served: int = Field(default=0, description="Total queries served")
    average_latency_ms: float = Field(default=0.0, description="Average query latency in ms")
    hit_rate: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Cache hit rate",
    )
    provider: str = Field(default="mock", description="Current LLM provider")