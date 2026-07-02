"""Step: Update model registry after retraining."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class UpdateRegistryStep(WorkflowStep):
    name = "update_registry"
    timeout_seconds = 30.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        retrain_result = ctx.get_step_result("retrain_models")
        if not retrain_result or not retrain_result.get("retrained"):
            return {"updated": False, "reason": "no_retrain"}

        model_name = retrain_result.get("model_name", "")
        from app.model_registry.registry import get_model_status

        status = get_model_status(model_name, ctx.restaurant_id)
        logger.info("Registry status for %s: %s", model_name, status)
        return {"updated": True, "model_name": model_name, "status": status}
