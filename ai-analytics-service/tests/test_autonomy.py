"""Tests for autonomy models, action registry, and confidence scoring."""

from __future__ import annotations

import pytest

from app.autonomy.action_registry import (
    ActionDef,
    clear_actions,
    get_action,
    list_actions,
    register_action,
)
from app.autonomy.confidence import compute_confidence, meets_threshold
from app.autonomy.models import (
    ActionRecord,
    ActionStatus,
    ApprovalLevel,
    ApprovalRequest,
    AutonomyStatus,
    Decision,
    Observation,
    Plan,
    PlanStep,
    RiskLevel,
)


class TestObservation:
    def test_defaults(self) -> None:
        obs = Observation(domain="revenue", metric="daily_total", current_value=500, expected_value=1000)
        assert obs.severity == "low"
        assert obs.observed_at

    def test_deviation(self) -> None:
        obs = Observation(deviation_pct=-50.0, severity="high", domain="revenue", metric="weekly")
        assert obs.deviation_pct == -50.0


class TestDecision:
    def test_creation(self) -> None:
        d = Decision(restaurant_id="r1", action_name="generate_forecast", confidence=0.85, risk="MEDIUM")
        assert d.decision_id
        assert d.confidence == 0.85

    def test_serialization(self) -> None:
        d = Decision(restaurant_id="r1", action_name="test")
        data = d.model_dump(mode="json")
        restored = Decision.model_validate(data)
        assert restored.decision_id == d.decision_id


class TestPlan:
    def test_plan_with_steps(self) -> None:
        plan = Plan(
            decision_id="d1",
            restaurant_id="r1",
            steps=[
                PlanStep(name="Step 1", action_name="generate_forecast"),
                PlanStep(name="Step 2", action_name="send_webhook"),
            ],
        )
        assert len(plan.steps) == 2
        assert plan.status == "CREATED"


class TestApprovalRequest:
    def test_creation(self) -> None:
        req = ApprovalRequest(
            restaurant_id="r1",
            action_name="retrain_model",
            approval_level="OWNER_APPROVAL",
            reason="Model drift detected",
        )
        assert req.request_id
        assert req.status == "PENDING"


class TestConfidence:
    def test_high_deviation_high_confidence(self) -> None:
        obs = Observation(deviation_pct=60.0, severity="critical", domain="revenue", metric="daily")
        assert compute_confidence(obs) >= 0.9

    def test_low_deviation_low_confidence(self) -> None:
        obs = Observation(deviation_pct=3.0, severity="low", domain="revenue", metric="daily")
        assert compute_confidence(obs) <= 0.3

    def test_medium_deviation(self) -> None:
        obs = Observation(deviation_pct=20.0, severity="medium", domain="revenue", metric="daily")
        conf = compute_confidence(obs)
        assert 0.5 <= conf <= 0.9

    def test_meets_threshold(self) -> None:
        assert meets_threshold(0.8, 0.6)
        assert not meets_threshold(0.4, 0.6)

    def test_edge_values(self) -> None:
        obs = Observation(deviation_pct=0.0, severity="low", domain="x", metric="y")
        conf = compute_confidence(obs)
        assert 0.0 <= conf <= 1.0


class TestActionRegistry:
    def test_builtin_actions_registered(self) -> None:
        actions = list_actions()
        names = [a["name"] for a in actions]
        assert "generate_forecast" in names
        assert "retrain_model" in names
        assert "delete_records" in names

    def test_get_action(self) -> None:
        action = get_action("retrain_model")
        assert action is not None
        assert action.approval_level == "OWNER_APPROVAL"
        assert action.risk == "MEDIUM"

    def test_register_custom(self) -> None:
        register_action(ActionDef("custom_action", risk="LOW", approval_level="SAFE"))
        assert get_action("custom_action") is not None

    def test_action_to_dict(self) -> None:
        action = get_action("generate_forecast")
        assert action is not None
        d = action.to_dict()
        assert d["name"] == "generate_forecast"
        assert "risk" in d
        assert "approval_level" in d


class TestEnums:
    def test_approval_levels(self) -> None:
        assert ApprovalLevel.SAFE == "SAFE"
        assert ApprovalLevel.OWNER_APPROVAL == "OWNER_APPROVAL"
        assert ApprovalLevel.ADMIN_APPROVAL == "ADMIN_APPROVAL"

    def test_risk_levels(self) -> None:
        assert RiskLevel.LOW == "LOW"
        assert RiskLevel.CRITICAL == "CRITICAL"

    def test_action_status(self) -> None:
        assert ActionStatus.PENDING == "PENDING"
        assert ActionStatus.COMPLETED == "COMPLETED"
