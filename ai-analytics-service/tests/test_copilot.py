"""Tests for AI Copilot endpoints — Milestone 5."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


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
class TestCopilotChat:
    """POST /api/v1/copilot/chat"""

    async def test_chat_requires_auth(self, client: AsyncClient) -> None:
        """401 when no Authorization header is present."""
        response = await client.post("/api/v1/copilot/chat", json={"message": "Hello"})
        assert response.status_code == 401

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """200 with valid auth — returns structured chat response."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "What was my revenue this week?"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert isinstance(data["answer"], str)
        assert len(data["answer"]) > 0
        assert "sources" in data
        assert isinstance(data["sources"], list)
        assert "confidence" in data
        assert isinstance(data["confidence"], (int, float))
        assert 0.0 <= data["confidence"] <= 1.0
        assert "intent" in data
        assert isinstance(data["intent"], str)
        assert "provider" in data
        assert isinstance(data["provider"], str)
        assert "response_time_ms" in data
        assert isinstance(data["response_time_ms"], (int, float))

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_response_has_explanation(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """The response should include a structured explanation."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "Why is my revenue down?"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "explanation" in data
        explanation = data["explanation"]
        if explanation is not None:
            assert "reasons" in explanation
            assert "trends" in explanation
            assert "recommendations" in explanation
            assert "summary" in explanation

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_empty_message_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """422 when message is empty."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_missing_message_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """422 when message field is missing."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_message_too_long_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """422 when message exceeds 2000 characters."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "x" * 2001},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_various_intents(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Test chat with different intent-triggering messages."""
        messages = [
            "What was my revenue this week?",
            "Who are my VIP customers?",
            "Forecast next week's sales",
            "What is my stock level?",
            "When is peak hour?",
            "What are my best items?",
            "What do you recommend?",
        ]
        for msg in messages:
            response = await client.post(
                "/api/v1/copilot/chat",
                json={"message": msg},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["intent"] in (
                "REVENUE", "CUSTOMERS", "FORECAST", "INVENTORY",
                "OPERATIONS", "MENU", "RECOMMENDATIONS", "GENERAL",
            )

    async def test_chat_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        """401 with expired token."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_chat_with_invalid_token(self, client: AsyncClient) -> None:
        """401 with malformed token."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "Hello"},
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    async def test_chat_missing_bearer_prefix(self, client: AsyncClient) -> None:
        """401 with missing Bearer prefix."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "Hello"},
            headers={"Authorization": "NoBearer token"},
        )
        assert response.status_code == 401

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_chat_provider_is_mock_by_default(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Default provider should be 'mock' when no API keys configured."""
        response = await client.post(
            "/api/v1/copilot/chat",
            json={"message": "Hello"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == "mock"


@pytest.mark.asyncio
class TestCopilotStats:
    """GET /api/v1/copilot/stats"""

    async def test_stats_requires_auth(self, client: AsyncClient) -> None:
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/copilot/stats")
        assert response.status_code == 401

    async def test_stats_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """200 with valid auth — returns stats structure."""
        response = await client.get("/api/v1/copilot/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "questionsAnswered" in data
        assert isinstance(data["questionsAnswered"], int)
        assert "averageResponseTime" in data
        assert isinstance(data["averageResponseTime"], (int, float))
        assert "provider" in data
        assert isinstance(data["provider"], str)

    async def test_stats_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        """401 with expired token."""
        response = await client.get(
            "/api/v1/copilot/stats",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_stats_with_invalid_token(self, client: AsyncClient) -> None:
        """401 with malformed token."""
        response = await client.get(
            "/api/v1/copilot/stats",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    @pytest.mark.skipif(not _DB_OK, reason="PostgreSQL is not available")
    async def test_stats_increments_after_chat(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Stats should increment after a chat message."""
        # Get initial stats
        r1 = await client.get("/api/v1/copilot/stats", headers=auth_headers)
        initial = r1.json()["questionsAnswered"]

        # Send a chat message
        await client.post(
            "/api/v1/copilot/chat",
            json={"message": "Hello"},
            headers=auth_headers,
        )

        # Get updated stats
        r2 = await client.get("/api/v1/copilot/stats", headers=auth_headers)
        updated = r2.json()["questionsAnswered"]

        assert updated >= initial