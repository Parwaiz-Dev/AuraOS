"""Tests for RAG Query endpoint — Milestone 7.

POST /api/v1/rag/query — full RAG Q&A pipeline (retrieve → context → generate → cite).
GET /api/v1/rag/stats — RAG observability metrics.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/rag/query
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestQueryAuth:
    """Authentication tests for the query endpoint."""

    async def test_query_requires_auth(self, client: AsyncClient) -> None:
        """POST /query without auth header should return 401."""
        response = await client.post(
            "/api/v1/rag/query",
            json={"question": "What is on the menu?"},
        )
        assert response.status_code == 401

    async def test_query_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        """POST /query with an expired JWT should return 401."""
        response = await client.post(
            "/api/v1/rag/query",
            headers={"Authorization": f"Bearer {expired_token}"},
            json={"question": "What is on the menu?"},
        )
        assert response.status_code == 401

    async def test_query_with_invalid_token(self, client: AsyncClient) -> None:
        """POST /query with a malformed JWT should return 401."""
        response = await client.post(
            "/api/v1/rag/query",
            headers={"Authorization": "Bearer not.a.real.token"},
            json={"question": "What is on the menu?"},
        )
        assert response.status_code == 401

    async def test_query_missing_bearer_prefix(self, client: AsyncClient) -> None:
        """POST /query with a token missing 'Bearer ' should return 401."""
        response = await client.post(
            "/api/v1/rag/query",
            headers={"Authorization": "some-token-without-bearer"},
            json={"question": "What is on the menu?"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestQueryValid:
    """Successful query tests."""

    async def test_query_returns_query_response(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query with valid auth should return 200 with QueryResponse."""
        # Upload a document first so there's context to retrieve
        doc_content = (
            b"Our restaurant menu includes:\n"
            b"- Margherita Pizza: $12.99\n"
            b"- Pepperoni Pizza: $14.99\n"
            b"- Caesar Salad: $9.99\n"
            b"- Garlic Bread: $5.99\n"
        )
        await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("menu.txt", doc_content, "text/plain")},
        )

        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "What pizzas are on the menu?"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["question"] == "What pizzas are on the menu?"
        assert "answer" in data
        assert isinstance(data["answer"], str)
        assert len(data["answer"]) > 0
        assert "sources" in data
        assert isinstance(data["sources"], list)
        assert "provider" in data
        assert "latency_ms" in data
        assert isinstance(data["latency_ms"], (int, float))
        assert "token_usage" in data

    async def test_query_with_custom_top_k(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query should accept a custom top_k parameter."""
        # Upload a document first
        await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("info.txt", b"Restaurant information and policies document.", "text/plain")},
        )

        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "What are the policies?", "top_k": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["sources"]) <= 3

    async def test_query_on_empty_store(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Querying without any documents should still return an answer (no context)."""
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "What is the revenue today?"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert isinstance(data["answer"], str)
        # No sources since no documents are uploaded
        assert data["sources"] == []

    async def test_query_sources_have_required_fields(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Each source/citation should have document_id, document_type, chunk_id, text, confidence."""
        # Upload a document
        await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("menu.txt", b"Pizza $12.99, Pasta $10.99, Salad $8.99", "text/plain")},
        )

        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "How much is the pizza?"},
        )
        assert response.status_code == 200
        data = response.json()
        for source in data["sources"]:
            assert "document_id" in source
            assert "document_type" in source
            assert "chunk_id" in source
            assert "text" in source
            assert "confidence" in source
            assert 0 <= source["confidence"] <= 1


@pytest.mark.asyncio
class TestQueryValidation:
    """Input validation tests for the query endpoint."""

    async def test_query_missing_question(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query without a question should return 422."""
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 422

    async def test_query_empty_question(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query with an empty question should return 422."""
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": ""},
        )
        assert response.status_code == 422

    async def test_query_question_too_long(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query with a question exceeding 2000 chars should return 422."""
        long_question = "x" * 2001
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": long_question},
        )
        assert response.status_code == 422

    async def test_query_top_k_too_low(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query with top_k < 1 should return 422."""
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "test", "top_k": 0},
        )
        assert response.status_code == 422

    async def test_query_top_k_too_high(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query with top_k > 20 should return 422."""
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "test", "top_k": 21},
        )
        assert response.status_code == 422

    async def test_query_question_only_whitespace(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /query with whitespace-only question passes min_length=1 but
        produces an answer (no useful context to retrieve)."""
        response = await client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={"question": "   "},
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/rag/stats
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestStatsAuth:
    """Authentication tests for the stats endpoint."""

    async def test_stats_requires_auth(self, client: AsyncClient) -> None:
        """GET /stats without auth header should return 401."""
        response = await client.get("/api/v1/rag/stats")
        assert response.status_code == 401

    async def test_stats_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        """GET /stats with an expired JWT should return 401."""
        response = await client.get(
            "/api/v1/rag/stats",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_stats_with_invalid_token(self, client: AsyncClient) -> None:
        """GET /stats with a malformed JWT should return 401."""
        response = await client.get(
            "/api/v1/rag/stats",
            headers={"Authorization": "Bearer not.a.real.token"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestStatsValid:
    """Successful stats tests."""

    async def test_stats_returns_rag_stats_response(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /stats with valid auth should return 200 with RAGStatsResponse."""
        response = await client.get(
            "/api/v1/rag/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "documents" in data
        assert "chunks" in data
        assert "queries_served" in data
        assert "average_latency_ms" in data
        assert "hit_rate" in data
        assert "provider" in data
        assert isinstance(data["documents"], int)
        assert isinstance(data["chunks"], int)
        assert isinstance(data["queries_served"], int)
        assert isinstance(data["average_latency_ms"], (int, float))
        assert isinstance(data["hit_rate"], (int, float))

    async def test_stats_reflects_uploaded_documents(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Stats should reflect the number of uploaded documents."""
        # Upload a document
        await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("doc.txt", b"Some content for stats testing.", "text/plain")},
        )

        response = await client.get(
            "/api/v1/rag/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["documents"] >= 1
        assert data["chunks"] >= 1