"""Autonomous Engine — top-level orchestrator.

Observes → Decides → Plans → Approves/Executes → Records.

The engine coordinates the reasoning, decision, planning, approval,
and execution engines into a single cohesive pipeline.
"""

from __future__ import annotations

import json
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.autonomy.decision_engine import get_decision_engine
from app.autonomy.executor import get_executor
from app.autonomy.models import ActionRecord, AutonomyStatus, Decision, Observation
from app.autonomy.planner import get_planner
from app.config.settings import settings

logger = logging.getLogger(__name__)

_HISTORY_KEY = "autonomy:history"
_history: deque[dict[str, Any]] = deque(maxlen=1000)
_stats = {
    "total_decisions": 0,
    "total_actions": 0,
    "auto_executed": 0,
    "pending_approvals": 0,
    "completed": 0,
    "failed": 0,
}


class AutonomousEngine:
    """Orchestrates the full observe → decide → plan → execute pipeline."""

    async def process_observation(
        self,
        observation: Observation,
        restaurant_id: str,
        user_id: str = "",
    ) -> dict[str, Any]:
        t0 = time.monotonic()

        decision_engine = get_decision_engine()
        decision = decision_engine.make_decision(observation, restaurant_id)

        if decision is None:
            return {
                "action_taken": False,
                "reason": "Confidence below threshold or policy blocked",
            }

        _stats["total_decisions"] += 1

        planner = get_planner()
        plan = planner.create_plan(decision)

        executor = get_executor()
        records = await executor.execute_plan(plan, restaurant_id, user_id)

        _stats["total_actions"] += len(records)
        for r in records:
            if r.status == "COMPLETED":
                _stats["auto_executed"] += 1
                _stats["completed"] += 1
            elif r.status == "PENDING":
                _stats["pending_approvals"] += 1
            elif r.status == "FAILED":
                _stats["failed"] += 1

        elapsed = (time.monotonic() - t0) * 1000

        entry = {
            "decision_id": decision.decision_id,
            "action_name": decision.action_name,
            "confidence": decision.confidence,
            "risk": decision.risk,
            "plan_steps": len(plan.steps),
            "plan_status": plan.status,
            "records": [r.model_dump(mode="json") for r in records],
            "duration_ms": round(elapsed, 2),
            "restaurant_id": restaurant_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _history.appendleft(entry)
        await self._persist_history(entry)

        try:
            from app.events.event import BaseEvent
            from app.events.publisher import publish

            await publish(BaseEvent(
                event_name="AutonomousActionExecuted",
                restaurant_id=restaurant_id,
                metadata={
                    "action": decision.action_name,
                    "confidence": decision.confidence,
                    "plan_status": plan.status,
                },
            ))
        except Exception:
            pass

        return {
            "action_taken": True,
            "decision_id": decision.decision_id,
            "action_name": decision.action_name,
            "confidence": decision.confidence,
            "risk": decision.risk,
            "plan_status": plan.status,
            "steps_executed": sum(1 for r in records if r.status == "COMPLETED"),
            "pending_approvals": sum(1 for r in records if r.status == "PENDING"),
            "duration_ms": round(elapsed, 2),
        }

    async def run_action(
        self,
        action_name: str,
        restaurant_id: str,
        user_id: str = "",
        parameters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Manually trigger an autonomous action (from API)."""
        obs = Observation(
            domain=action_name,
            metric="manual_trigger",
            current_value=0,
            expected_value=0,
            deviation_pct=100,
            severity="high",
        )

        decision = Decision(
            restaurant_id=restaurant_id,
            observation=obs,
            action_name=action_name,
            confidence=1.0,
            risk="LOW",
            reasoning_summary="Manually triggered by user",
        )

        _stats["total_decisions"] += 1

        planner = get_planner()
        plan = planner.create_plan(decision)

        if parameters:
            for step in plan.steps:
                step.parameters.update(parameters)

        executor = get_executor()
        records = await executor.execute_plan(plan, restaurant_id, user_id)

        _stats["total_actions"] += len(records)
        for r in records:
            if r.status == "COMPLETED":
                _stats["auto_executed"] += 1
                _stats["completed"] += 1

        return {
            "action_name": action_name,
            "plan_status": plan.status,
            "records": [r.model_dump(mode="json") for r in records],
        }

    async def get_status(self) -> dict[str, Any]:
        from app.autonomy.action_registry import list_actions
        from app.autonomy.approval_engine import get_pending

        pending = await get_pending()

        total_actions = _stats["completed"] + _stats["failed"]
        success_rate = round(_stats["completed"] / total_actions * 100, 2) if total_actions > 0 else 0.0

        return AutonomyStatus(
            enabled=settings.AUTONOMY_ENABLED,
            total_decisions=_stats["total_decisions"],
            total_actions=_stats["total_actions"],
            pending_approvals=len(pending),
            auto_executed=_stats["auto_executed"],
            success_rate=success_rate,
            registered_actions=len(list_actions()),
        ).model_dump(mode="json")

    async def get_history(self, limit: int = 50) -> list[dict[str, Any]]:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                raws = await r.lrange(_HISTORY_KEY, 0, limit - 1)
                if raws:
                    return [json.loads(raw) for raw in raws]
        except Exception:
            pass
        return list(_history)[:limit]

    async def _persist_history(self, entry: dict[str, Any]) -> None:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                await r.lpush(_HISTORY_KEY, json.dumps(entry, default=str))
                await r.ltrim(_HISTORY_KEY, 0, 999)
        except Exception:
            logger.debug("Failed to persist autonomy history", exc_info=True)


_engine: AutonomousEngine | None = None


def get_autonomous_engine() -> AutonomousEngine:
    global _engine
    if _engine is None:
        _engine = AutonomousEngine()
    return _engine


def reset_autonomous_engine() -> None:
    global _engine, _stats
    _engine = None
    _history.clear()
    for key in _stats:
        _stats[key] = 0
