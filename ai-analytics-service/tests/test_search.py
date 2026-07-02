"""Tests for RAG Search endpoint — Milestone 7.

GET /api/v1/rag/search — hybrid vector + keyword search with caching.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/rag/search
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestSearchAuth:
    """Authentication tests for the search endpoint."""

    async def test_search_requires_auth(self, client: AsyncClient) -> None:
        """GET /search without auth header should return 401."""
        response = await client.get(
            "/api/v1/rag/search",
            params={"q": "test query"},
        )
        assert response.status_code == 401

    async def test_search_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        """GET /search with an expired JWT should return 401."""
        response = await client.get(
            "/api/v1/rag/search",
            headers={"Authorization": f"Bearer {expired_token}"},
            params={"q": "test query"},
        )
        assert response.status_code == 401

    async def test_search_with_invalid_token(self, client: AsyncClient) -> None:
        """GET /search with a malformed JWT should return 401."""
        response = await client.get(
            "/api/v1/rag/search",
            headers={"Authorization": "Bearer not.a.real.token"},
            params={"q": "test query"},
        )
        assert response.status_code == 401

    async def test_search_missing_bearer_prefix(self, client: AsyncClient) -> None:
        """GET /search with a token missing 'Bearer ' should return 401."""
        response = await client.get(
            "/api/v1/rag/search",
            headers={"Authorization": "some-token-without-bearer"},
            params={"q": "test query"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestSearchValid:
    """Successful search tests."""

    async def test_search_returns_search_response(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search with valid auth should return 200 with SearchResponse."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "menu items"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "menu items"
        assert "results" in data
        assert isinstance(data["results"], list)
        assert "total" in data
        assert "latency_ms" in data
        assert isinstance(data["latency_ms"], (int, float))

    async def test_search_empty_results_on_empty_store(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Searching an empty store should return zero results."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "nothing should match this query"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["results"] == []

    async def test_search_with_top_k_param(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search should accept a custom top_k parameter."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "test", "top_k": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] <= 3

    async def test_search_with_document_type_filter(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search should accept a document_type filter."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "test", "document_type": "txt"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["results"], list)

    async def test_search_results_have_required_fields(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Each search result should contain chunk_id, document_id, text, score."""
        # First upload a document so there's something to search
        await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("menu.txt", b"Pizza, Pasta, Salad, Burger, Fries", "text/plain")},
        )

        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "Pizza"},
        )
        assert response.status_code == 200
        data = response.json()
        if data["results"]:
            result = data["results"][0]
            assert "chunk_id" in result
            assert "document_id" in result
            assert "document_type" in result
            assert "text" in result
            assert "score" in result
            assert "metadata" in result


@pytest.mark.asyncio
class TestSearchValidation:
    """Input validation tests for the search endpoint."""

    async def test_search_missing_query_param(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search without the required 'q' param should return 422."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_search_empty_query(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search with an empty query should return 422."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": ""},
        )
        assert response.status_code == 422

    async def test_search_query_too_long(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search with a query exceeding 500 chars should return 422."""
        long_query = "x" * 501
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": long_query},
        )
        assert response.status_code == 422

    async def test_search_top_k_too_low(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search with top_k < 1 should return 422."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "test", "top_k": 0},
        )
        assert response.status_code == 422

    async def test_search_top_k_too_high(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /search with top_k > 20 should return 422."""
        response = await client.get(
            "/api/v1/rag/search",
            headers=auth_headers,
            params={"q": "test", "top_k": 21},
        )
        assert response.status_code == 422