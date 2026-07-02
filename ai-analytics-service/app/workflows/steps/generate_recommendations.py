"""Step: Generate item recommendations."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class GenerateRecommendationsStep(WorkflowStep):
    name = "generate_recommendations"
    timeout_seconds = 60.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.database import _async_session_factory
        from app.services.recommendation_service import get_recommendations

        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            recs = await get_recommendations(session, ctx.restaurant_id, limit=10)

        count = len(recs) if recs else 0
        logger.info("Generated %d recommendations for restaurant=%s", count, ctx.restaurant_id)
        return {"recommendation_count": count}
