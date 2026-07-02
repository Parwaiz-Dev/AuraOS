"""Planner — generates multi-step execution plans from decisions."""

from __future__ import annotations

import logging
from typing import Any

from app.autonomy.action_registry import get_action
from app.autonomy.models import Decision, Plan, PlanStep

logger = logging.getLogger(__name__)

_PLAN_TEMPLATES: dict[str, list[dict[str, str]]] = {
    "revenue_recovery": [
        {"name": "Analyze Forecast", "action": "generate_forecast"},
        {"name": "Identify Low Selling Items", "action": "generate_insight"},
        {"name": "Generate Promotion Recommendations", "action": "generate_recommendation"},
        {"name": "Notify Owner", "action": "send_webhook"},
    ],
    "customer_retention": [
        {"name": "Segment At-Risk Customers", "action": "generate_insight"},
        {"name": "Generate Retention Recommendations", "action": "generate_recommendation"},
        {"name": "Create Retention Report", "action": "create_report"},
        {"name": "Notify Owner", "action": "send_webhook"},
    ],
    "retrain_model": [
        {"name": "Detect Drift", "action": "generate_insight"},
        {"name": "Retrain Model", "action": "retrain_model"},
        {"name": "Publish Event", "action": "publish_event"},
    ],
    "modify_inventory": [
        {"name": "Predict Inventory Needs", "action": "generate_insight"},
        {"name": "Generate Purchase Advice", "action": "generate_recommendation"},
        {"name": "Notify Owner", "action": "send_webhook"},
    ],
}


class Planner:
    """Generates multi-step plans from decisions."""

    def create_plan(self, decision: Decision) -> Plan:
        template = _PLAN_TEMPLATES.get(decision.action_name)

        if template:
            steps = self._build_from_template(template)
        else:
            steps = self._build_single_step(decision)

        plan = Plan(
            decision_id=decision.decision_id,
            restaurant_id=decision.restaurant_id,
            steps=steps,
            status="CREATED",
        )

        logger.info(
            "Plan created: %d steps for action=%s restaurant=%s",
            len(steps), decision.action_name, decision.restaurant_id,
        )
        return plan

    def _build_from_template(self, template: list[dict[str, str]]) -> list[PlanStep]:
        steps = []
        for entry in template:
            action = get_action(entry["action"])
            approval = action.approval_level if action else "SAFE"
            steps.append(PlanStep(
                name=entry["name"],
                action_name=entry["action"],
                approval_level=approval,
            ))
        return steps

    def _build_single_step(self, decision: Decision) -> list[PlanStep]:
        action = get_action(decision.action_name)
        approval = action.approval_level if action else "SAFE"
        return [PlanStep(
            name=f"Execute {decision.action_name}",
            action_name=decision.action_name,
            approval_level=approval,
        )]


_planner: Planner | None = None


def get_planner() -> Planner:
    global _planner
    if _planner is None:
        _planner = Planner()
    return _planner
