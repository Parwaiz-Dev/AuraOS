"""Step: Collect analytics data for a restaurant."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class CollectDataStep(WorkflowStep):
    name = "collect_data"
    timeout_seconds = 60.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.database import _async_session_factory
        from app.services.dashboard_service import get_dashboard

        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            dashboard = await get_dashboard(session, ctx.restaurant_id)

        logger.info("Collected data for restaurant=%s", ctx.restaurant_id)
        return {"dashboard": dashboard}
