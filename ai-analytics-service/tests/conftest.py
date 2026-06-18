"""Pytest configuration and shared fixtures for the AI Analytics service."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

# Import the FastAPI app instance
from app.main import app


# ── Event loop ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create a session-scoped event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── HTTP client ─────────────────────────────────────────────────────────────────


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client that talks directly to the FastAPI app (no network)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Auth helpers ────────────────────────────────────────────────────────────────


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Return a minimal set of auth headers with a valid-looking JWT.

    The token is signed with the settings.JWT_SECRET so it passes validation.
    """
    import jwt as pyjwt

    from app.config.settings import settings

    token = pyjwt.encode(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": "test@auraos.com",
            "role": "ADMIN",
            "restaurantId": "00000000-0000-0000-0000-000000000002",
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def expired_token() -> str:
    """Return an expired JWT for testing 401 handling."""
    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone

    from app.config.settings import settings

    return pyjwt.encode(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": "expired@auraos.com",
            "role": "WAITER",
            "restaurantId": "00000000-0000-0000-0000-000000000002",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )