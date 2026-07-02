"""Workflow executor — runs a workflow instance and persists the result."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.config.settings import settings
from app.workflows.workflow import Workflow
from app.workflows.workflow_context import WorkflowContext
from app.workflows.workflow_result import WorkflowResult

logger = logging.getLogger(__name__)

_STORE_KEY = "workflows:executions"
_SORTED_KEY = "workflows:timeline"
_RESTAURANT_PREFIX = "workflows:restaurant:"


class WorkflowExecutor:
    """Runs a workflow and persists the execution record."""

    async def execute(
        self,
        workflow: Workflow,
        *,
        restaurant_id: str = "",
        user_id: str = "",
        request_id: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> WorkflowResult:
        ctx = WorkflowContext(
            restaurant_id=restaurant_id,
            user_id=user_id,
            request_id=request_id or str(uuid.uuid4()),
            metadata=metadata or {},
        )

        logger.info(
            "Starting workflow %s (execution=%s, restaurant=%s)",
            workflow.name, ctx.execution_id, restaurant_id,
        )

        result = await workflow.run(ctx)

        await self._persist(result)

        # Publish event
        try:
            from app.events.publisher import publish
            from app.events.event import BaseEvent

            await publish(BaseEvent(
                event_name="WorkflowCompleted",
                restaurant_id=restaurant_id,
                metadata={
                    "workflow_id": result.workflow_id,
                    "workflow_name": result.workflow_name,
                    "execution_id": result.execution_id,
                    "state": result.state,
                    "duration_ms": result.duration_ms,
                },
            ))
        except Exception:
            logger.debug("Failed to publish WorkflowCompleted event", exc_info=True)

        logger.info(
            "Workflow %s completed: state=%s duration=%.1fms",
            workflow.name, result.state, result.duration_ms,
        )
        return result

    async def _persist(self, result: WorkflowResult) -> None:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if not await is_redis_available():
                return

            r = await get_redis()
            data = result.model_dump(mode="json")
            serialized = json.dumps(data, default=str)
            ts = datetime.now(timezone.utc).timestamp()

            pipe = r.pipeline()
            pipe.hset(_STORE_KEY, result.execution_id, serialized)
            pipe.zadd(_SORTED_KEY, {result.execution_id: ts})

            if result.restaurant_id:
                rkey = f"{_RESTAURANT_PREFIX}{result.restaurant_id}"
                pipe.zadd(rkey, {result.execution_id: ts})
                pipe.expire(rkey, settings.WORKFLOWS_STORE_TTL_SECONDS)

            pipe.expire(_STORE_KEY, settings.WORKFLOWS_STORE_TTL_SECONDS)
            pipe.expire(_SORTED_KEY, settings.WORKFLOWS_STORE_TTL_SECONDS)
            await pipe.execute()
        except Exception:
            logger.debug("Failed to persist workflow execution", exc_info=True)


async def get_execution(execution_id: str) -> dict[str, Any] | None:
    try:
        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            raw = await r.hget(_STORE_KEY, execution_id)
            if raw:
                return json.loads(raw)
    except Exception:
        pass
    return None


async def query_executions(
    *,
    restaurant_id: str | None = None,
    workflow_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    try:
        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            if restaurant_id:
                rkey = f"{_RESTAURANT_PREFIX}{restaurant_id}"
                ids = await r.zrevrange(rkey, 0, -1)
            else:
                ids = await r.zrevrange(_SORTED_KEY, 0, -1)
            if ids:
                raws = await r.hmget(_STORE_KEY, *ids)
                entries = [json.loads(raw) for raw in raws if raw is not None]
    except Exception:
        logger.debug("Failed to query workflow executions", exc_info=True)

    if workflow_id:
        entries = [e for e in entries if e.get("workflow_id") == workflow_id]
    if status:
        entries = [e for e in entries if e.get("state") == status]

    total = len(entries)
    start = (page - 1) * page_size
    items = entries[start:start + page_size]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
    }


async def get_workflow_stats() -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    try:
        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            ids = await r.zrevrange(_SORTED_KEY, 0, -1)
            if ids:
                raws = await r.hmget(_STORE_KEY, *ids)
                entries = [json.loads(raw) for raw in raws if raw is not None]
    except Exception:
        pass

    total = len(entries)
    success = sum(1 for e in entries if e.get("state") == "SUCCESS")
    failed = sum(1 for e in entries if e.get("state") == "FAILED")
    cancelled = sum(1 for e in entries if e.get("state") == "CANCELLED")
    timed_out = sum(1 for e in entries if e.get("state") == "TIMEOUT")
    rolled_back = sum(1 for e in entries if e.get("state") == "ROLLED_BACK")
    durations = [e.get("duration_ms", 0) for e in entries if e.get("duration_ms")]
    avg_duration = round(sum(durations) / len(durations), 2) if durations else 0.0
    retries = sum(e.get("retries", 0) for e in entries)

    by_workflow: dict[str, int] = {}
    for e in entries:
        wname = e.get("workflow_name", "unknown")
        by_workflow[wname] = by_workflow.get(wname, 0) + 1

    return {
        "total_workflows": total,
        "success": success,
        "failed": failed,
        "cancelled": cancelled,
        "timed_out": timed_out,
        "rolled_back": rolled_back,
        "success_rate": round(success / total * 100, 2) if total else 0.0,
        "failure_rate": round(failed / total * 100, 2) if total else 0.0,
        "average_duration_ms": avg_duration,
        "total_retries": retries,
        "by_workflow": by_workflow,
    }
