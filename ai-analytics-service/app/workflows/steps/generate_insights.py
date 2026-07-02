"""Step: Generate daily insights."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class GenerateInsightsStep(WorkflowStep):
    name = "generate_insights"
    timeout_seconds = 120.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.database import _async_session_factory
        from app.services.insight_service import get_daily_insights

        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            insights = await get_daily_insights(session, ctx.restaurant_id)

        counts = insights.get("counts", {})
        logger.info("Insights generated for restaurant=%s", ctx.restaurant_id)
        return {"insights": counts}
