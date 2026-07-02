"""Tests for autonomous workflows — end-to-end pipeline."""

from __future__ import annotations

import pytest

from app.autonomy.autonomous_engine import get_autonomous_engine, reset_autonomous_engine
from app.autonomy.models import Observation


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_autonomous_engine()


@pytest.mark.asyncio
class TestAutonomousWorkflows:
    async def test_process_high_confidence_observation(self) -> None:
        engine = get_autonomous_engine()
        obs = Observation(
            domain="revenue",
            metric="daily_total",
            current_value=200,
            expected_value=1000,
            deviation_pct=-80.0,
            severity="critical",
        )
        result = await engine.process_observation(obs, restaurant_id="r1")
        assert result["action_taken"] is True
        assert result["confidence"] >= 0.8
        assert result["action_name"] != ""

    async def test_process_low_confidence_observation(self) -> None:
        engine = get_autonomous_engine()
        obs = Observation(
            domain="revenue",
            metric="daily_total",
            current_value=990,
            expected_value=1000,
            deviation_pct=-1.0,
            severity="low",
        )
        result = await engine.process_observation(obs, restaurant_id="r1")
        assert result["action_taken"] is False

    async def test_manual_run_safe_action(self) -> None:
        engine = get_autonomous_engine()
        result = await engine.run_action(
            action_name="generate_forecast",
            restaurant_id="r1",
            user_id="u1",
        )
        assert result["action_name"] == "generate_forecast"
        assert result["plan_status"] in ("COMPLETED", "FAILED", "WAITING_APPROVAL")

    async def test_manual_run_approval_required(self) -> None:
        engine = get_autonomous_engine()
        result = await engine.run_action(
            action_name="retrain_model",
            restaurant_id="r1",
            user_id="u1",
        )
        assert result["action_name"] == "retrain_model"

    async def test_get_status(self) -> None:
        engine = get_autonomous_engine()
        status = await engine.get_status()
        assert "enabled" in status
        assert "total_decisions" in status
        assert "registered_actions" in status
        assert status["registered_actions"] >= 10

    async def test_get_empty_history(self) -> None:
        engine = get_autonomous_engine()
        history = await engine.get_history()
        assert isinstance(history, list)

    async def test_history_records_after_action(self) -> None:
        engine = get_autonomous_engine()
        obs = Observation(
            domain="orders",
            metric="daily_count",
            current_value=10,
            expected_value=100,
            deviation_pct=-90.0,
            severity="critical",
        )
        await engine.process_observation(obs, restaurant_id="r1")
        history = await engine.get_history()
        assert len(history) >= 1
        assert history[0]["restaurant_id"] == "r1"

    async def test_inventory_critical_triggers_action(self) -> None:
        engine = get_autonomous_engine()
        obs = Observation(
            domain="inventory",
            metric="stock_level",
            current_value=1,
            expected_value=50,
            deviation_pct=-98.0,
            severity="critical",
        )
        result = await engine.process_observation(obs, restaurant_id="r1")
        assert result["action_taken"] is True

    async def test_customer_retention_trigger(self) -> None:
        engine = get_autonomous_engine()
        obs = Observation(
            domain="customers",
            metric="churn_risk",
            current_value=40,
            expected_value=5,
            deviation_pct=700.0,
            severity="critical",
        )
        result = await engine.process_observation(obs, restaurant_id="r1")
        assert result["action_taken"] is True
        assert result["action_name"] == "customer_retention"


@pytest.mark.asyncio
class TestAutonomousAPIIntegration:
    async def test_api_status(self, client, auth_headers) -> None:
        response = await client.get("/api/v1/autonomy/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data

    async def test_api_actions(self, client, auth_headers) -> None:
        response = await client.get("/api/v1/autonomy/actions", headers=auth_headers)
        assert response.status_code == 200
        actions = response.json()
        assert isinstance(actions, list)
        assert len(actions) >= 10

    async def test_api_history(self, client, auth_headers) -> None:
        response = await client.get("/api/v1/autonomy/history", headers=auth_headers)
        assert response.status_code == 200

    async def test_api_pending(self, client, auth_headers) -> None:
        response = await client.get("/api/v1/autonomy/pending-approvals", headers=auth_headers)
        assert response.status_code == 200

    async def test_api_run_requires_admin(self, client, waiter_headers) -> None:
        response = await client.post(
            "/api/v1/autonomy/run",
            json={"action_name": "generate_forecast"},
            headers=waiter_headers,
        )
        assert response.status_code == 403

    async def test_api_approve_requires_admin(self, client, waiter_headers) -> None:
        response = await client.post(
            "/api/v1/autonomy/approve",
            json={"request_id": "x"},
            headers=waiter_headers,
        )
        assert response.status_code == 403

    async def test_api_reject_not_found(self, client, auth_headers) -> None:
        response = await client.post(
            "/api/v1/autonomy/reject",
            json={"request_id": "nonexistent"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_api_run_missing_action(self, client, auth_headers) -> None:
        response = await client.post(
            "/api/v1/autonomy/run",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_api_auth_required(self, client) -> None:
        response = await client.get("/api/v1/autonomy/status")
        assert response.status_code == 401
