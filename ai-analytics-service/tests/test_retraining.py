"""Tests for the manual retraining endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.schemas import RetrainRequest


class TestRetrainRequestSchema:
    """Tests for the RetrainRequest Pydantic schema."""

    def test_valid_model_names_accepted(self):
        """All 6 valid model names should be accepted."""
        valid = [
            "revenue_forecast",
            "order_forecast",
            "customer_segmentation",
            "recommendation_engine",
            "wait_time_prediction",
            "inventory_prediction",
        ]
        for name in valid:
            req = RetrainRequest(model=name)
            assert req.model == name

    def test_invalid_model_name_rejected(self):
        """Invalid model names should raise a validation error."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RetrainRequest(model="invalid_model")

    def test_empty_model_name_rejected(self):
        """Empty model name should raise a validation error."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RetrainRequest(model="")


class TestRetrainEndpoint:
    """Tests for POST /api/v1/models/retrain."""

    @pytest.mark.asyncio
    async def test_retrain_endpoint_requires_auth(self, client: AsyncClient):
        """POST /api/v1/models/retrain without token should return 401."""
        response = await client.post(
            "/api/v1/models/retrain",
            json={"model": "revenue_forecast"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_retrain_endpoint_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """POST /api/v1/models/retrain with valid token should return 200 or 503.

        Returns 503 if the scheduler is not running (expected in test environment).
        Returns 200 if the scheduler is running and the job was triggered.
        """
        response = await client.post(
            "/api/v1/models/retrain",
            json={"model": "revenue_forecast"},
            headers=auth_headers,
        )
        # In test environment, scheduler is not running → 503 is expected
        assert response.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_retrain_endpoint_invalid_model(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """POST /api/v1/models/retrain with invalid model should return 422."""
        response = await client.post(
            "/api/v1/models/retrain",
            json={"model": "nonexistent_model"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_retrain_endpoint_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ):
        """POST /api/v1/models/retrain with expired token should return 401."""
        response = await client.post(
            "/api/v1/models/retrain",
            json={"model": "revenue_forecast"},
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_retrain_endpoint_missing_body(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """POST /api/v1/models/retrain without body should return 422."""
        response = await client.post(
            "/api/v1/models/retrain",
            headers=auth_headers,
        )
        assert response.status_code == 422