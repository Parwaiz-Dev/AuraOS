"""Tests for dashboard endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ── Dashboard ────────────────────────────────────────────────────────────────────


async def test_dashboard_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/dashboard without auth → 401."""
    response = await client.get("/api/v1/dashboard")
    assert response.status_code == 401


async def test_dashboard_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/dashboard returns a dashboard object."""
    response = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)


async def test_dashboard_has_kpi_fields(client: AsyncClient, auth_headers: dict) -> None:
    """Dashboard response contains all required KPI fields."""
    response = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    # Required numeric fields
    assert "totalOrders" in data
    assert "completedOrders" in data
    assert "cancelledOrders" in data
    assert "totalRevenue" in data
    assert "averageOrderValue" in data
    assert "activeCustomers" in data
    assert "repeatCustomers" in data

    # Optional fields (may be null)
    assert "peakHour" in data
    assert "topSellingItem" in data

    # Chart data
    assert "hourlySales" in data
    assert "weeklySales" in data
    assert "monthlySales" in data
    assert "topItems" in data
    assert "generatedAt" in data


async def test_dashboard_chart_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify chart payloads have labels and values."""
    response = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    for chart_key in ["hourlySales", "weeklySales", "monthlySales"]:
        chart = data[chart_key]
        assert "labels" in chart
        assert "values" in chart
        assert isinstance(chart["labels"], list)
        assert isinstance(chart["values"], list)


async def test_dashboard_top_items_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify topItems is a list with correct item shape."""
    response = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data["topItems"], list)
    if data["topItems"]:
        item = data["topItems"][0]
        assert "itemName" in item
        assert "quantitySold" in item
        assert "revenue" in item
        assert "categoryName" in item


# ── Auth ─────────────────────────────────────────────────────────────────────────


async def test_dashboard_invalid_token(client: AsyncClient) -> None:
    """Dashboard with garbage token → 401."""
    response = await client.get(
        "/api/v1/dashboard",
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert response.status_code == 401


async def test_dashboard_expired_token(client: AsyncClient, expired_token: str) -> None:
    """Dashboard with expired token → 401."""
    response = await client.get(
        "/api/v1/dashboard",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


async def test_dashboard_missing_bearer(client: AsyncClient) -> None:
    """Dashboard with Authorization header but no Bearer scheme → 401."""
    response = await client.get(
        "/api/v1/dashboard",
        headers={"Authorization": "Basic dGVzdDp0ZXN0"},
    )
    assert response.status_code == 401