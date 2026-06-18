"""Tests for top items, top categories, and frequently-bought-together endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ── Top Items ────────────────────────────────────────────────────────────────────


async def test_top_items_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/top-items without auth → 401."""
    response = await client.get("/api/v1/analytics/top-items")
    assert response.status_code == 401


async def test_top_items_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/top-items returns a list."""
    response = await client.get("/api/v1/analytics/top-items", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_top_items_response_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify top items response fields."""
    response = await client.get("/api/v1/analytics/top-items", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if data:
        item = data[0]
        assert "itemName" in item
        assert "quantitySold" in item
        assert "revenue" in item
        assert "profit" in item
        assert "categoryName" in item


async def test_top_items_with_date_range(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/top-items with date filters."""
    response = await client.get(
        "/api/v1/analytics/top-items",
        headers=auth_headers,
        params={"start_date": "2025-01-01", "end_date": "2025-12-31", "limit": 10},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_top_items_order_by_quantity(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/top-items sorted by quantity."""
    response = await client.get(
        "/api/v1/analytics/top-items",
        headers=auth_headers,
        params={"order_by": "quantity"},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_top_items_invalid_order_by(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/top-items with invalid order_by → 422."""
    response = await client.get(
        "/api/v1/analytics/top-items",
        headers=auth_headers,
        params={"order_by": "invalid"},
    )
    assert response.status_code == 422


# ── Top Categories ───────────────────────────────────────────────────────────────


async def test_top_categories_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/top-categories without auth → 401."""
    response = await client.get("/api/v1/analytics/top-categories")
    assert response.status_code == 401


async def test_top_categories_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/top-categories returns a list."""
    response = await client.get("/api/v1/analytics/top-categories", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_top_categories_response_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify top categories response fields."""
    response = await client.get("/api/v1/analytics/top-categories", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if data:
        cat = data[0]
        assert "categoryName" in cat
        assert "quantitySold" in cat
        assert "revenue" in cat


# ── Frequently Bought Together ───────────────────────────────────────────────────


async def test_frequently_bought_together_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/frequently-bought-together without auth → 401."""
    response = await client.get("/api/v1/analytics/frequently-bought-together")
    assert response.status_code == 401


async def test_frequently_bought_together_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/frequently-bought-together returns a list."""
    response = await client.get(
        "/api/v1/analytics/frequently-bought-together", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_frequently_bought_together_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify frequently-bought-together response fields."""
    response = await client.get(
        "/api/v1/analytics/frequently-bought-together", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    if data:
        pair = data[0]
        assert "itemA" in pair
        assert "itemB" in pair
        assert "frequency" in pair


# ── Auth ─────────────────────────────────────────────────────────────────────────


async def test_top_items_invalid_token(client: AsyncClient) -> None:
    """Top items with garbage token → 401."""
    response = await client.get(
        "/api/v1/analytics/top-items",
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert response.status_code == 401


async def test_top_items_expired_token(client: AsyncClient, expired_token: str) -> None:
    """Top items with expired token → 401."""
    response = await client.get(
        "/api/v1/analytics/top-items",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401