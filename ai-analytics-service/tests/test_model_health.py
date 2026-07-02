"""Tests for model health computation and endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.model_registry.registry import ALL_MODEL_NAMES
from app.monitoring.model_health import compute_model_health, get_model_health_summary


class TestComputeModelHealth:
    """Tests for the model health computation logic."""

    def test_compute_model_health_returns_all_models(self):
        """compute_model_health should return entries for all 6 model names."""
        health = compute_model_health()
        assert len(health) == 6
        for name in ALL_MODEL_NAMES:
            assert name in health

    def test_compute_model_health_defaults_to_no_model(self):
        """All models should default to 'no_model' when no metadata exists."""
        health = compute_model_health()
        for info in health.values():
            assert info["status"] == "no_model"
            assert info["active_count"] == 0
            assert info["failed_count"] == 0

    def test_compute_model_health_has_expected_keys(self):
        """Each health entry should have status, active_count, failed_count, total_versions."""
        health = compute_model_health()
        for info in health.values():
            assert "status" in info
            assert "active_count" in info
            assert "failed_count" in info
            assert "total_versions" in info

    def test_get_model_health_summary_returns_none_for_unknown(self):
        """get_model_health_summary should return None for unknown model names."""
        result = get_model_health_summary("nonexistent_model")
        assert result is None

    def test_get_model_health_summary_returns_dict_for_known(self):
        """get_model_health_summary should return a dict for known model names."""
        result = get_model_health_summary("revenue_forecast")
        assert result is not None
        assert "status" in result


# ── API Endpoint Tests ───────────────────────────────────────────────────────────


class TestModelHealthEndpoint:
    """Tests for GET /api/v1/models/health."""

    @pytest.mark.asyncio
    async def test_health_endpoint_requires_auth(self, client: AsyncClient):
        """GET /api/v1/models/health without token should return 401."""
        response = await client.get("/api/v1/models/health")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_health_endpoint_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """GET /api/v1/models/health with valid token should return 200."""
        response = await client.get("/api/v1/models/health", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        for name in ALL_MODEL_NAMES:
            assert name in data["models"]
            assert "status" in data["models"][name]

    @pytest.mark.asyncio
    async def test_health_endpoint_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """GET /api/v1/models/health with expired token should return 401."""
        response = await client.get(
            "/api/v1/models/health",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_health_endpoint_with_invalid_token(self, client: AsyncClient):
        """GET /api/v1/models/health with invalid token should return 401."""
        response = await client.get(
            "/api/v1/models/health",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401


class TestMetricsEndpoint:
    """Tests for GET /api/v1/metrics/models."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint_requires_auth(self, client: AsyncClient):
        """GET /api/v1/metrics/models without token should return 401."""
        response = await client.get("/api/v1/metrics/models")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_metrics_endpoint_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """GET /api/v1/metrics/models with valid token should return 200."""
        response = await client.get("/api/v1/metrics/models", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "totalModels" in data
        assert "healthyModels" in data
        assert "failedModels" in data
        assert "averageAccuracy" in data
        assert "models" in data

    @pytest.mark.asyncio
    async def test_metrics_endpoint_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """GET /api/v1/metrics/models with expired token should return 401."""
        response = await client.get(
            "/api/v1/metrics/models",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401