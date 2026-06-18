"""Tests for the health endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ── Global health (no auth) ─────────────────────────────────────────────────────


async def test_global_health_returns_200(client: AsyncClient) -> None:
    """GET /health should return 200 with service metadata."""
    response = await client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "AuraOS AI Analytics"
    assert "version" in data
    assert "database" in data
    assert "redis" in data


# ── Authenticated health ────────────────────────────────────────────────────────


async def test_authenticated_health_returns_200(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """GET /api/v1/health with valid token should return 200."""
    response = await client.get("/api/v1/health", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["authenticated"] is True
    assert data["user"]["id"] == "00000000-0000-0000-0000-000000000001"
    assert data["user"]["role"] == "ADMIN"


async def test_authenticated_health_no_token_returns_401(client: AsyncClient) -> None:
    """GET /api/v1/health without token should return 401."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 401


async def test_authenticated_health_invalid_token_returns_401(
    client: AsyncClient,
) -> None:
    """GET /api/v1/health with garbage token should return 401."""
    response = await client.get(
        "/api/v1/health",
        headers={"Authorization": "Bearer garbage_token"},
    )
    assert response.status_code == 401


async def test_authenticated_health_expired_token_returns_401(
    client: AsyncClient, expired_token: str
) -> None:
    """GET /api/v1/health with expired token should return 401."""
    response = await client.get(
        "/api/v1/health",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


async def test_authenticated_health_missing_bearer_prefix_returns_401(
    client: AsyncClient,
) -> None:
    """GET /api/v1/health with token but no Bearer prefix should return 401."""
    response = await client.get(
        "/api/v1/health",
        headers={"Authorization": "some_token"},
    )
    assert response.status_code == 401


# ── OpenAPI docs ────────────────────────────────────────────────────────────────


async def test_openapi_docs_accessible(client: AsyncClient) -> None:
    """GET /docs (Swagger) should return 200."""
    response = await client.get("/docs")
    assert response.status_code == 200


async def test_openapi_json_accessible(client: AsyncClient) -> None:
    """GET /openapi.json should return 200 with valid JSON."""
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "AuraOS AI Analytics"
    assert "/api/v1/health" in data["paths"]