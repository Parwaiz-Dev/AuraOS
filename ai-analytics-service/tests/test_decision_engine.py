"""Tests for the Decision Engine."""

from __future__ import annotations

import pytest

from app.autonomy.decision_engine import get_decision_engine, reset_decision_engine
from app.autonomy.models import Decision, Observation
from app.autonomy.policy_engine import block_action, unblock_action


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_decision_engine()
    yield  # type: ignore[misc]
    unblock_action("generate_forecast")


class TestDecisionEngine:
    def test_high_confidence_decision(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="revenue", metric="daily_total",
            current_value=500, expected_value=1000,
            deviation_pct=-50.0, severity="critical",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is not None
        assert decision.confidence >= 0.8
        assert decision.action_name != ""

    def test_low_confidence_returns_none(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="revenue", metric="daily_total",
            current_value=990, expected_value=1000,
            deviation_pct=-1.0, severity="low",
        )
        decision = engine.make_decision(obs, "r1", confidence_threshold=0.6)
        assert decision is None

    def test_blocked_action_returns_none(self) -> None:
        engine = get_decision_engine()
        block_action("generate_forecast")
        obs = Observation(
            domain="revenue", metric="daily_total",
            current_value=500, expected_value=1000,
            deviation_pct=-50.0, severity="high",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is None

    def test_revenue_critical_maps_to_recovery(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="revenue", metric="daily_total",
            current_value=200, expected_value=1000,
            deviation_pct=-80.0, severity="critical",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is not None
        assert decision.action_name == "revenue_recovery"

    def test_customer_critical_maps_to_retention(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="customers", metric="churn_rate",
            current_value=30, expected_value=5,
            deviation_pct=500.0, severity="critical",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is not None
        assert decision.action_name == "customer_retention"

    def test_drift_maps_to_retrain(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="drift", metric="mape",
            current_value=0.5, expected_value=0.1,
            deviation_pct=400.0, severity="high",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is not None
        assert decision.action_name == "retrain_model"

    def test_decision_has_alternatives(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="revenue", metric="total",
            current_value=500, expected_value=1000,
            deviation_pct=-50.0, severity="high",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is not None
        assert isinstance(decision.alternative_actions, list)
        assert len(decision.alternative_actions) > 0

    def test_decision_has_expected_benefit(self) -> None:
        engine = get_decision_engine()
        obs = Observation(
            domain="inventory", metric="stock",
            current_value=2, expected_value=50,
            deviation_pct=-96.0, severity="critical",
        )
        decision = engine.make_decision(obs, "r1")
        assert decision is not None
        assert decision.expected_benefit != ""
