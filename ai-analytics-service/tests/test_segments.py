"""Tests for Customer Segmentation endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestCustomerSegments:
    """GET /api/v1/customers/segments"""

    async def test_segments_requires_auth(self, client: AsyncClient):
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/customers/segments")
        assert response.status_code == 401

    async def test_segments_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with valid auth — returns list (possibly empty)."""
        response = await client.get(
            "/api/v1/customers/segments", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            item = data[0]
            assert "customerId" in item
            assert "name" in item
            assert "segment" in item
            assert item["segment"] in ("VIP", "Loyal", "Regular", "At Risk", "Lost")
            assert "recencyDays" in item
            assert "frequency" in item
            assert "monetary" in item
            assert "totalSpent" in item

    async def test_segments_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """401 with expired token."""
        response = await client.get(
            "/api/v1/customers/segments",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_segments_invalid_token(self, client: AsyncClient):
        """401 with malformed token."""
        response = await client.get(
            "/api/v1/customers/segments",
            headers={"Authorization": "Bearer bad.token"},
        )
        assert response.status_code == 401

    async def test_segments_missing_bearer(self, client: AsyncClient):
        """401 with missing Bearer prefix."""
        response = await client.get(
            "/api/v1/customers/segments",
            headers={"Authorization": "token_without_bearer"},
        )
        assert response.status_code == 401