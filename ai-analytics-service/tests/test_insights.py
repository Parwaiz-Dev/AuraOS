"""Tests for Insights API endpoints — Milestone 6.

Covers:
    GET /api/v1/insights/daily
    GET /api/v1/insights/weekly
    GET /api/v1/insights/history
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


# ── DB availability check (sync psycopg2, never touches async engine) ─────────

def _pg_is_reachable() -> bool:
    """Return True if PostgreSQL is reachable and queryable.

    Uses a synchronous psycopg2 connection — no asyncpg, no SQLAlchemy
    engine, no event loop interaction. Safe to call at module import time.
    """
    try:
        import psycopg2

        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            user="auraos_user",
            password="auraos_password",
            database="auraos",
            connect_timeout=3,
        )
        conn.close()
        return True
    except Exception:  # noqa: BLE001
        return False


_DB_OK: bool = _pg_is_reachable()
"""Module-level flag: True when PostgreSQL is fully reachable."""


@pytest.mark.asyncio
class TestDailyInsights:
    """GET /api/v1/insights/daily"""

    async def test_daily_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/insights/daily")
        assert response.status_code == 401

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_daily_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/insights/daily", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "anomalies" in data
        assert "trends" in data
        assert "opportunities" in data
        assert "risks" in data
        assert "summary" in data
        assert "counts" in data

    async def test_daily_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        response = await client.get(
            "/api/v1/insights/daily",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_daily_with_invalid_token(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/insights/daily",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    async def test_daily_missing_bearer_prefix(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/insights/daily",
            headers={"Authorization": "token"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestWeeklyReport:
    """GET /api/v1/insights/weekly"""

    async def test_weekly_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/insights/weekly")
        assert response.status_code == 401

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_weekly_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/insights/weekly", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "anomalies" in data
        assert "trends" in data
        assert "opportunities" in data
        assert "risks" in data
        assert "counts" in data

    async def test_weekly_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        response = await client.get(
            "/api/v1/insights/weekly",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_weekly_with_invalid_token(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/insights/weekly",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestInsightHistory:
    """GET /api/v1/insights/history"""

    async def test_history_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/insights/history")
        assert response.status_code == 401

    async def test_history_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/insights/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert isinstance(data["entries"], list)
        assert isinstance(data["total"], int)

    async def test_history_with_limit_param(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get(
            "/api/v1/insights/history?limit=5", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] <= 5

    async def test_history_invalid_limit_422(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get(
            "/api/v1/insights/history?limit=0", headers=auth_headers
        )
        assert response.status_code == 422

    async def test_history_limit_too_high_422(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        response = await client.get(
            "/api/v1/insights/history?limit=999", headers=auth_headers
        )
        assert response.status_code == 422

    async def test_history_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        response = await client.get(
            "/api/v1/insights/history",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_history_with_invalid_token(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/insights/history",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401