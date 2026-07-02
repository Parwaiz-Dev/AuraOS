"""Tests for Inventory Prediction endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestInventoryPrediction:
    """GET /api/v1/predict/inventory"""

    async def test_inventory_requires_auth(self, client: AsyncClient):
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/predict/inventory")
        assert response.status_code == 401

    async def test_inventory_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with valid auth — returns list (possibly empty)."""
        response = await client.get(
            "/api/v1/predict/inventory", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            item = data[0]
            assert "itemId" in item
            assert "name" in item
            assert "unit" in item
            assert "currentStock" in item
            assert "dailyRate" in item
            assert "depletionDate" in item
            assert "daysRemaining" in item
            assert "reorderDate" in item
            assert "reorderQuantity" in item
            assert "needsReorder" in item
            assert isinstance(item["needsReorder"], bool)

    async def test_inventory_with_item_ids(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 when item_ids query param is provided."""
        response = await client.get(
            "/api/v1/predict/inventory?item_ids=1,2,3", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_inventory_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """401 with expired token."""
        response = await client.get(
            "/api/v1/predict/inventory",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_inventory_invalid_token(self, client: AsyncClient):
        """401 with malformed token."""
        response = await client.get(
            "/api/v1/predict/inventory",
            headers={"Authorization": "Bearer bad.jwt.token"},
        )
        assert response.status_code == 401

    async def test_inventory_no_auth(self, client: AsyncClient):
        """401 with no Authorization header."""
        response = await client.get("/api/v1/predict/inventory")
        assert response.status_code == 401