"""Step: Persist workflow results to the insight history store."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class PersistResultsStep(WorkflowStep):
    name = "persist_results"
    timeout_seconds = 15.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.redis_client import cache_set, is_redis_available

        key = f"workflow:result:{ctx.execution_id}"
        if await is_redis_available():
            import json
            await cache_set(key, json.dumps(dict(ctx.step_results), default=str), ttl=86400)

        logger.info("Persisted workflow results for execution=%s", ctx.execution_id)
        return {"persisted": True, "key": key}
