"""Tests for Forecast endpoints — Revenue & Order forecasting."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
class TestRevenueForecast:
    """GET /api/v1/forecast/revenue"""

    async def test_forecast_revenue_requires_auth(self, client: AsyncClient):
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/forecast/revenue")
        assert response.status_code == 401

    async def test_forecast_revenue_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with valid auth — returns forecast structure (or 404 if no data)."""
        response = await client.get("/api/v1/forecast/revenue", headers=auth_headers)
        assert response.status_code in (200, 404)
        if response.status_code == 200:
            data = response.json()
            assert "forecast" in data
            assert "trend" in data
            assert data["trend"] in ("upward", "downward", "stable")
            assert "growthPercentage" in data
            assert isinstance(data["growthPercentage"], (int, float))
            assert "confidence" in data
            assert isinstance(data["confidence"], (int, float))

    async def test_forecast_revenue_custom_days(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Accepts days=7, days=30, days=90."""
        for days in (7, 30, 90):
            response = await client.get(
                f"/api/v1/forecast/revenue?days={days}", headers=auth_headers
            )
            assert response.status_code in (200, 404)

    async def test_forecast_revenue_invalid_days(
        self, client: AsyncClient, auth_headers: dict
    ):
        """422 when days < 7 or > 90."""
        for days in (5, 100):
            response = await client.get(
                f"/api/v1/forecast/revenue?days={days}", headers=auth_headers
            )
            assert response.status_code == 422

    async def test_forecast_revenue_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """401 with expired token."""
        response = await client.get(
            "/api/v1/forecast/revenue",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_forecast_revenue_invalid_token(self, client: AsyncClient):
        """401 with malformed token."""
        response = await client.get(
            "/api/v1/forecast/revenue",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestOrderForecast:
    """GET /api/v1/forecast/orders"""

    async def test_forecast_orders_requires_auth(self, client: AsyncClient):
        """401 when no Authorization header is present."""
        response = await client.get("/api/v1/forecast/orders")
        assert response.status_code == 401

    async def test_forecast_orders_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """200 with valid auth — returns forecast structure (or 404 if no data)."""
        response = await client.get("/api/v1/forecast/orders", headers=auth_headers)
        assert response.status_code in (200, 404)
        if response.status_code == 200:
            data = response.json()
            assert "forecast" in data
            assert "trend" in data
            assert data["trend"] in ("upward", "downward", "stable")
            assert "growthPercentage" in data
            assert "confidence" in data

    async def test_forecast_orders_custom_days(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Accepts days=7, 30, 90."""
        for days in (7, 30, 90):
            response = await client.get(
                f"/api/v1/forecast/orders?days={days}", headers=auth_headers
            )
            assert response.status_code in (200, 404)

    async def test_forecast_orders_invalid_days(
        self, client: AsyncClient, auth_headers: dict
    ):
        """422 when days < 7 or > 90."""
        response = await client.get(
            "/api/v1/forecast/orders?days=5", headers=auth_headers
        )
        assert response.status_code == 422

    async def test_forecast_orders_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """401 with expired token."""
        response = await client.get(
            "/api/v1/forecast/orders",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_forecast_orders_missing_bearer(self, client: AsyncClient):
        """401 with malformed authorization header."""
        response = await client.get(
            "/api/v1/forecast/orders",
            headers={"Authorization": "NotBearer token"},
        )
        assert response.status_code == 401