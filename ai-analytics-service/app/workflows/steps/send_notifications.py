"""Step: Send notifications."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class SendNotificationsStep(WorkflowStep):
    name = "send_notifications"
    timeout_seconds = 30.0

    def should_skip(self, ctx: WorkflowContext) -> bool:
        from app.config.settings import settings
        return not settings.NOTIFY_ENABLED

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        insights_data = ctx.get_step_result("generate_insights")
        if not insights_data:
            return {"sent": False, "reason": "no_insights"}

        logger.warning(
            "Notification step for restaurant=%s — delivery not implemented, skipping",
            ctx.restaurant_id,
        )
        return {"sent": False, "reason": "not_implemented"}
