"""Decision Engine — converts observations into actionable decisions."""

from __future__ import annotations

import logging
from typing import Any

from app.autonomy.confidence import meets_threshold
from app.autonomy.models import Decision, Observation
from app.autonomy.policy_engine import evaluate_policy
from app.autonomy.reasoning_engine import get_reasoning_engine

logger = logging.getLogger(__name__)


class DecisionEngine:
    """Evaluates observations and produces decisions."""

    def make_decision(
        self,
        observation: Observation,
        restaurant_id: str,
        *,
        confidence_threshold: float = 0.6,
    ) -> Decision | None:
        """Convert an observation into a decision, or None if confidence is too low."""
        engine = get_reasoning_engine()
        action_name, confidence, trace = engine.reason(observation)

        if not meets_threshold(confidence, confidence_threshold):
            logger.info(
                "Decision skipped: confidence %.2f below threshold %.2f for %s",
                confidence, confidence_threshold, observation.domain,
            )
            return None

        policy = evaluate_policy(action_name, restaurant_id)
        if not policy["allowed"]:
            logger.warning("Action %s blocked by policy: %s", action_name, policy["reason"])
            return None

        decision = Decision(
            restaurant_id=restaurant_id,
            observation=observation,
            action_name=action_name,
            confidence=confidence,
            risk=trace.risk_evaluation,
            reasoning_summary=trace.to_summary(),
            alternative_actions=[a["action"] for a in trace.alternatives],
            expected_benefit=trace.expected_benefit,
            estimated_cost=trace.cost_evaluation,
        )

        logger.info(
            "Decision made: action=%s confidence=%.2f risk=%s restaurant=%s",
            action_name, confidence, trace.risk_evaluation, restaurant_id,
        )
        return decision


_engine: DecisionEngine | None = None


def get_decision_engine() -> DecisionEngine:
    global _engine
    if _engine is None:
        _engine = DecisionEngine()
    return _engine


def reset_decision_engine() -> None:
    global _engine
    _engine = None
