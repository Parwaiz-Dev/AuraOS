"""Tests for the Planner."""

from __future__ import annotations

import pytest

from app.autonomy.models import Decision, Observation
from app.autonomy.planner import get_planner


class TestPlanner:
    def test_revenue_recovery_plan(self) -> None:
        planner = get_planner()
        decision = Decision(
            restaurant_id="r1",
            action_name="revenue_recovery",
            confidence=0.9,
        )
        plan = planner.create_plan(decision)
        assert len(plan.steps) == 4
        assert plan.steps[0].action_name == "generate_forecast"
        assert plan.steps[-1].action_name == "send_webhook"

    def test_customer_retention_plan(self) -> None:
        planner = get_planner()
        decision = Decision(
            restaurant_id="r1",
            action_name="customer_retention",
            confidence=0.85,
        )
        plan = planner.create_plan(decision)
        assert len(plan.steps) == 4
        assert plan.steps[0].action_name == "generate_insight"

    def test_retrain_model_plan(self) -> None:
        planner = get_planner()
        decision = Decision(
            restaurant_id="r1",
            action_name="retrain_model",
            confidence=0.8,
        )
        plan = planner.create_plan(decision)
        assert len(plan.steps) == 3
        retrain_step = next(s for s in plan.steps if s.action_name == "retrain_model")
        assert retrain_step.approval_level == "OWNER_APPROVAL"

    def test_single_step_plan(self) -> None:
        planner = get_planner()
        decision = Decision(
            restaurant_id="r1",
            action_name="generate_forecast",
            confidence=0.7,
        )
        plan = planner.create_plan(decision)
        assert len(plan.steps) == 1
        assert plan.steps[0].action_name == "generate_forecast"
        assert plan.steps[0].approval_level == "SAFE"

    def test_modify_inventory_plan(self) -> None:
        planner = get_planner()
        decision = Decision(
            restaurant_id="r1",
            action_name="modify_inventory",
            confidence=0.9,
        )
        plan = planner.create_plan(decision)
        assert len(plan.steps) == 3

    def test_plan_has_metadata(self) -> None:
        planner = get_planner()
        decision = Decision(
            restaurant_id="r1",
            action_name="revenue_recovery",
            decision_id="d1",
        )
        plan = planner.create_plan(decision)
        assert plan.decision_id == "d1"
        assert plan.restaurant_id == "r1"
        assert plan.status == "CREATED"
