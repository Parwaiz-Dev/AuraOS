"""Tests for revenue analytics endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ── Daily Revenue ────────────────────────────────────────────────────────────────


async def test_daily_revenue_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/revenue/daily without auth → 401."""
    response = await client.get("/api/v1/analytics/revenue/daily")
    assert response.status_code == 401


async def test_daily_revenue_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/daily returns a list (may be empty)."""
    response = await client.get("/api/v1/analytics/revenue/daily", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_daily_revenue_with_date_range(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/daily with date filters."""
    response = await client.get(
        "/api/v1/analytics/revenue/daily",
        headers=auth_headers,
        params={"start_date": "2025-01-01", "end_date": "2025-12-31", "limit": 30},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_daily_revenue_response_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify response fields when data is present."""
    response = await client.get("/api/v1/analytics/revenue/daily", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if data:
        entry = data[0]
        assert "date" in entry
        assert "totalRevenue" in entry
        assert "completedOrders" in entry
        assert "averageOrderValue" in entry
        assert "growthPercentage" in entry
        assert "peakHour" in entry
        assert "topDay" in entry
        assert "topMonth" in entry


# ── Weekly Revenue ───────────────────────────────────────────────────────────────


async def test_weekly_revenue_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/revenue/weekly without auth → 401."""
    response = await client.get("/api/v1/analytics/revenue/weekly")
    assert response.status_code == 401


async def test_weekly_revenue_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/weekly returns a list."""
    response = await client.get("/api/v1/analytics/revenue/weekly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_weekly_revenue_response_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify response fields."""
    response = await client.get("/api/v1/analytics/revenue/weekly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if data:
        entry = data[0]
        assert "weekStart" in entry
        assert "weekEnd" in entry
        assert "totalRevenue" in entry
        assert "completedOrders" in entry
        assert "averageOrderValue" in entry
        assert "growthPercentage" in entry


# ── Monthly Revenue ──────────────────────────────────────────────────────────────


async def test_monthly_revenue_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/revenue/monthly without auth → 401."""
    response = await client.get("/api/v1/analytics/revenue/monthly")
    assert response.status_code == 401


async def test_monthly_revenue_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/monthly returns a list."""
    response = await client.get("/api/v1/analytics/revenue/monthly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_monthly_revenue_response_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify response fields."""
    response = await client.get("/api/v1/analytics/revenue/monthly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if data:
        entry = data[0]
        assert "month" in entry
        assert "totalRevenue" in entry
        assert "completedOrders" in entry
        assert "averageOrderValue" in entry
        assert "growthPercentage" in entry


# ── Yearly Revenue ───────────────────────────────────────────────────────────────


async def test_yearly_revenue_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/revenue/yearly without auth → 401."""
    response = await client.get("/api/v1/analytics/revenue/yearly")
    assert response.status_code == 401


async def test_yearly_revenue_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/yearly returns a list."""
    response = await client.get("/api/v1/analytics/revenue/yearly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_yearly_revenue_response_structure(client: AsyncClient, auth_headers: dict) -> None:
    """Verify response fields."""
    response = await client.get("/api/v1/analytics/revenue/yearly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if data:
        entry = data[0]
        assert "year" in entry
        assert "totalRevenue" in entry
        assert "completedOrders" in entry
        assert "averageOrderValue" in entry


# ── Revenue Trends ───────────────────────────────────────────────────────────────


async def test_revenue_trends_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/revenue/trends without auth → 401."""
    response = await client.get("/api/v1/analytics/revenue/trends")
    assert response.status_code == 401


async def test_revenue_trends_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/trends returns trends dict."""
    response = await client.get("/api/v1/analytics/revenue/trends", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "trends" in data
    assert "periods" in data
    assert isinstance(data["trends"], list)


# ── Peak Hours ───────────────────────────────────────────────────────────────────


async def test_peak_hours_requires_auth(client: AsyncClient) -> None:
    """GET /api/v1/analytics/revenue/peak-hours without auth → 401."""
    response = await client.get("/api/v1/analytics/revenue/peak-hours")
    assert response.status_code == 401


async def test_peak_hours_with_auth(client: AsyncClient, auth_headers: dict) -> None:
    """GET /api/v1/analytics/revenue/peak-hours returns a list."""
    response = await client.get("/api/v1/analytics/revenue/peak-hours", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# ── Invalid token ────────────────────────────────────────────────────────────────


async def test_revenue_with_invalid_token(client: AsyncClient) -> None:
    """Revenue endpoint with garbage token → 401."""
    response = await client.get(
        "/api/v1/analytics/revenue/daily",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


async def test_revenue_with_expired_token(client: AsyncClient, expired_token: str) -> None:
    """Revenue endpoint with expired token → 401."""
    response = await client.get(
        "/api/v1/analytics/revenue/daily",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401