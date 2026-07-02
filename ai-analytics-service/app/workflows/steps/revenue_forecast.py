"""Step: Generate revenue forecast."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class RevenueForecastStep(WorkflowStep):
    name = "revenue_forecast"
    timeout_seconds = 120.0
    retries = 1

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.database import _async_session_factory
        from app.services.revenue_forecast_service import get_revenue_forecast

        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            forecast = await get_revenue_forecast(session, ctx.restaurant_id, days=30)

        logger.info("Revenue forecast generated for restaurant=%s", ctx.restaurant_id)
        return {"forecast": forecast}
