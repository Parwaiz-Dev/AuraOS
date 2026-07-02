"""Tests for Recommendation endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestRecommendations:
    """GET /api/v1/recommendations/items"""

    async def test_recommendations_requires_auth(self, client: AsyncClient):
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/recommendations/items")
        assert response.status_code == 401

    async def test_recommendations_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with valid auth — returns list (possibly empty)."""
        response = await client.get(
            "/api/v1/recommendations/items", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            item = data[0]
            assert "itemId" in item
            assert "itemName" in item
            assert "confidence" in item
            assert "support" in item

    async def test_recommendations_with_item_ids(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 when item_ids query param is provided."""
        response = await client.get(
            "/api/v1/recommendations/items?item_ids=1,2,3", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_recommendations_custom_limit(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with custom limit."""
        response = await client.get(
            "/api/v1/recommendations/items?limit=5", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5

    async def test_recommendations_invalid_limit(
        self, client: AsyncClient, auth_headers: dict
    ):
        """422 when limit > 50 or < 1."""
        for limit in (0, 51):
            response = await client.get(
                f"/api/v1/recommendations/items?limit={limit}", headers=auth_headers
            )
            assert response.status_code == 422

    async def test_recommendations_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """401 with expired token."""
        response = await client.get(
            "/api/v1/recommendations/items",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_recommendations_missing_bearer(self, client: AsyncClient):
        """401 with missing Bearer prefix."""
        response = await client.get(
            "/api/v1/recommendations/items",
            headers={"Authorization": "plain_token"},
        )
        assert response.status_code == 401