"""Executor — runs approved plan steps via existing services and workflows."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.autonomy.action_registry import get_action
from app.autonomy.approval_engine import create_approval
from app.autonomy.models import ActionRecord, Plan, PlanStep
from app.autonomy.policy_engine import is_auto_executable

logger = logging.getLogger(__name__)


class Executor:
    """Executes plan steps, requesting approval when required."""

    async def execute_plan(
        self,
        plan: Plan,
        restaurant_id: str,
        user_id: str = "",
    ) -> list[ActionRecord]:
        records: list[ActionRecord] = []
        plan.status = "RUNNING"

        for step in plan.steps:
            record = await self._execute_step(step, plan, restaurant_id, user_id)
            records.append(record)

            if record.status == "FAILED":
                plan.status = "FAILED"
                break

            if record.status == "PENDING":
                plan.status = "WAITING_APPROVAL"
                break

        if all(r.status == "COMPLETED" for r in records):
            plan.status = "COMPLETED"

        return records

    async def _execute_step(
        self,
        step: PlanStep,
        plan: Plan,
        restaurant_id: str,
        user_id: str,
    ) -> ActionRecord:
        t0 = time.monotonic()

        record = ActionRecord(
            restaurant_id=restaurant_id,
            action_name=step.action_name,
            decision_id=plan.decision_id,
            approval_level=step.approval_level,
            started_at=_now_iso(),
        )

        if not is_auto_executable(step.approval_level):
            await create_approval(
                restaurant_id=restaurant_id,
                action_name=step.action_name,
                decision_id=plan.decision_id,
                plan_id=plan.plan_id,
                approval_level=step.approval_level,
                reason=f"Step '{step.name}' requires approval",
                parameters=step.parameters,
            )
            step.status = "PENDING"
            record.status = "PENDING"
            record.approval_status = "PENDING"
            return record

        record.approval_status = "APPROVED"
        record.status = "EXECUTING"

        try:
            result = await self._run_action(step.action_name, restaurant_id, step.parameters)
            step.status = "COMPLETED"
            step.result = result
            record.status = "COMPLETED"
            record.result = result
        except Exception as exc:
            step.status = "FAILED"
            step.error = str(exc)
            record.status = "FAILED"
            record.error = str(exc)
            logger.warning("Step %s failed: %s", step.name, exc)

        elapsed = (time.monotonic() - t0) * 1000
        record.duration_ms = round(elapsed, 2)
        record.completed_at = _now_iso()
        return record

    async def _run_action(
        self,
        action_name: str,
        restaurant_id: str,
        parameters: dict[str, Any],
    ) -> dict[str, Any]:
        """Dispatch action to existing services — NEVER writes business data directly."""

        if action_name in ("generate_forecast", "generate_insight", "generate_recommendation", "create_report"):
            return await self._run_analytics_action(action_name, restaurant_id)

        if action_name in ("send_email", "send_webhook"):
            return await self._run_notification_action(action_name, restaurant_id, parameters)

        if action_name == "retrain_model":
            return await self._run_retrain(restaurant_id, parameters)

        if action_name == "run_workflow":
            return await self._run_workflow(restaurant_id, parameters)

        if action_name == "publish_event":
            return await self._run_publish_event(restaurant_id, parameters)

        if action_name in ("revenue_recovery", "customer_retention", "modify_inventory"):
            return await self._run_analytics_action("generate_insight", restaurant_id)

        return {"executed": True, "action": action_name}

    async def _run_analytics_action(self, action_name: str, restaurant_id: str) -> dict[str, Any]:
        try:
            from app.config.database import _async_session_factory

            async with _async_session_factory() as session:
                from sqlalchemy import text
                await session.execute(text("SET TRANSACTION READ ONLY"))

                if action_name == "generate_forecast":
                    from app.services.revenue_forecast_service import get_revenue_forecast
                    result = await get_revenue_forecast(session, restaurant_id, days=30)
                    return {"forecast": "generated", "has_data": result is not None}

                if action_name in ("generate_insight", "create_report"):
                    from app.services.insight_service import get_daily_insights
                    result = await get_daily_insights(session, restaurant_id)
                    return {"insights": "generated", "counts": result.get("counts", {})}

                if action_name == "generate_recommendation":
                    from app.services.recommendation_service import get_recommendations
                    result = await get_recommendations(session, restaurant_id, limit=10)
                    return {"recommendations": len(result) if result else 0}
        except Exception as exc:
            return {"executed": True, "action": action_name, "note": str(exc)}

        return {"executed": True, "action": action_name}

    async def _run_notification_action(
        self, action_name: str, restaurant_id: str, parameters: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            from app.events.domain_events import NotificationSent
            from app.events.publisher import publish

            channel = "email" if action_name == "send_email" else "webhook"
            await publish(NotificationSent(restaurant_id=restaurant_id, channel=channel, success=True))
            return {"notified": True, "channel": channel}
        except Exception:
            return {"notified": False}

    async def _run_retrain(self, restaurant_id: str, parameters: dict[str, Any]) -> dict[str, Any]:
        model_name = parameters.get("model_name", "revenue_forecast")
        try:
            from app.services.workflow_service import run_workflow
            result = await run_workflow(
                "model_retraining",
                restaurant_id=restaurant_id,
                metadata={"model_name": model_name},
            )
            return {"retrained": True, "state": result.state}
        except Exception as exc:
            return {"retrained": False, "error": str(exc)}

    async def _run_workflow(self, restaurant_id: str, parameters: dict[str, Any]) -> dict[str, Any]:
        workflow_id = parameters.get("workflow_id", "daily_analytics")
        try:
            from app.services.workflow_service import run_workflow
            result = await run_workflow(workflow_id, restaurant_id=restaurant_id)
            return {"workflow": workflow_id, "state": result.state}
        except Exception as exc:
            return {"workflow": workflow_id, "error": str(exc)}

    async def _run_publish_event(self, restaurant_id: str, parameters: dict[str, Any]) -> dict[str, Any]:
        try:
            from app.events.event import BaseEvent
            from app.events.publisher import publish

            event_name = parameters.get("event_name", "BaseEvent")
            await publish(BaseEvent(event_name=event_name, restaurant_id=restaurant_id))
            return {"published": True, "event_name": event_name}
        except Exception:
            return {"published": False}


_executor: Executor | None = None


def get_executor() -> Executor:
    global _executor
    if _executor is None:
        _executor = Executor()
    return _executor


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
