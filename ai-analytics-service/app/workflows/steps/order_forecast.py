"""Step: Generate order forecast."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class OrderForecastStep(WorkflowStep):
    name = "order_forecast"
    timeout_seconds = 120.0
    retries = 1

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.database import _async_session_factory
        from app.services.order_forecast_service import get_order_forecast

        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            forecast = await get_order_forecast(session, ctx.restaurant_id, days=30)

        logger.info("Order forecast generated for restaurant=%s", ctx.restaurant_id)
        return {"forecast": forecast}
