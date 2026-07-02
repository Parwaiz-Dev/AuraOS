"""Reasoning Engine — internal chain-of-thought and decision tree evaluation.

All reasoning is internal-only and NEVER exposed through APIs. The engine
produces a structured reasoning trace that feeds the decision and planning
engines but is stripped before any API response.
"""

from __future__ import annotations

import logging
from typing import Any

from app.autonomy.confidence import compute_confidence
from app.autonomy.models import Observation, RiskLevel

logger = logging.getLogger(__name__)


class ReasoningTrace:
    """Internal-only structured reasoning trace."""

    __slots__ = ("steps", "alternatives", "risk_evaluation", "cost_evaluation", "expected_benefit")

    def __init__(self) -> None:
        self.steps: list[str] = []
        self.alternatives: list[dict[str, Any]] = []
        self.risk_evaluation: str = ""
        self.cost_evaluation: str = ""
        self.expected_benefit: str = ""

    def add_step(self, step: str) -> None:
        self.steps.append(step)

    def to_summary(self) -> str:
        if not self.steps:
            return "No reasoning steps recorded"
        return self.steps[-1]


class ReasoningEngine:
    """Evaluates observations through chain-of-thought reasoning."""

    def reason(self, observation: Observation) -> tuple[str, float, ReasoningTrace]:
        """Produce a recommended action, confidence, and reasoning trace.

        Returns (action_name, confidence, trace).
        """
        trace = ReasoningTrace()

        trace.add_step(f"Observed {observation.domain}.{observation.metric}: "
                       f"current={observation.current_value}, expected={observation.expected_value}")

        confidence = compute_confidence(observation)
        trace.add_step(f"Computed confidence: {confidence}")

        action_name = self._select_action(observation, trace)
        trace.add_step(f"Selected action: {action_name}")

        self._evaluate_risk(observation, trace)
        self._evaluate_alternatives(observation, action_name, trace)

        return action_name, confidence, trace

    def _select_action(self, obs: Observation, trace: ReasoningTrace) -> str:
        domain = obs.domain.lower()

        mapping = {
            "revenue": "generate_forecast",
            "orders": "generate_forecast",
            "inventory": "generate_insight",
            "customers": "generate_recommendation",
            "wait_time": "generate_insight",
            "forecast": "generate_forecast",
            "insights": "generate_insight",
            "drift": "retrain_model",
            "models": "retrain_model",
        }

        if obs.severity in ("critical", "high") and domain == "revenue":
            trace.add_step("High severity revenue issue → revenue_recovery")
            return "revenue_recovery"

        if obs.severity in ("critical", "high") and domain == "customers":
            trace.add_step("High severity customer issue → customer_retention")
            return "customer_retention"

        if obs.severity in ("critical", "high") and domain == "inventory":
            trace.add_step("High severity inventory issue → modify_inventory")
            return "modify_inventory"

        action = mapping.get(domain, "generate_insight")
        trace.add_step(f"Domain '{domain}' maps to action '{action}'")
        return action

    def _evaluate_risk(self, obs: Observation, trace: ReasoningTrace) -> None:
        deviation = abs(obs.deviation_pct)

        if deviation > 50 or obs.severity == "critical":
            trace.risk_evaluation = "HIGH"
        elif deviation > 25 or obs.severity == "high":
            trace.risk_evaluation = "MEDIUM"
        else:
            trace.risk_evaluation = "LOW"

        trace.add_step(f"Risk evaluation: {trace.risk_evaluation}")
        trace.cost_evaluation = "minimal" if trace.risk_evaluation == "LOW" else "moderate"
        trace.expected_benefit = f"Address {obs.domain} deviation of {obs.deviation_pct:.1f}%"

    def _evaluate_alternatives(
        self, obs: Observation, primary: str, trace: ReasoningTrace,
    ) -> None:
        alternatives = ["generate_insight", "create_report", "send_webhook"]
        trace.alternatives = [
            {"action": a, "reason": f"Alternative to {primary}"}
            for a in alternatives
            if a != primary
        ]


_engine: ReasoningEngine | None = None


def get_reasoning_engine() -> ReasoningEngine:
    global _engine
    if _engine is None:
        _engine = ReasoningEngine()
    return _engine
