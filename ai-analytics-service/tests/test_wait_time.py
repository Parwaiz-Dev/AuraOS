"""Tests for Wait Time Prediction endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestWaitTime:
    """GET /api/v1/predict/wait-time"""

    async def test_wait_time_requires_auth(self, client: AsyncClient):
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/predict/wait-time")
        assert response.status_code == 401

    async def test_wait_time_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with valid auth — returns estimate (or 404 if no data)."""
        response = await client.get(
            "/api/v1/predict/wait-time", headers=auth_headers
        )
        assert response.status_code in (200, 404)
        if response.status_code == 200:
            data = response.json()
            assert "estimatedWaitMinutes" in data
            assert isinstance(data["estimatedWaitMinutes"], (int, float))
            assert data["estimatedWaitMinutes"] >= 0
            assert "confidence" in data
            assert "factors" in data
            assert "activeOrders" in data["factors"]
            assert "tableOccupancy" in data["factors"]
            assert "kitchenLoad" in data["factors"]
            assert "generatedAt" in data

    async def test_wait_time_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """401 with expired token."""
        response = await client.get(
            "/api/v1/predict/wait-time",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_wait_time_invalid_token(self, client: AsyncClient):
        """401 with malformed token."""
        response = await client.get(
            "/api/v1/predict/wait-time",
            headers={"Authorization": "Bearer fake.jwt.token"},
        )
        assert response.status_code == 401

    async def test_wait_time_no_auth_header(self, client: AsyncClient):
        """401 with no Authorization header at all."""
        response = await client.get("/api/v1/predict/wait-time")
        assert response.status_code == 401