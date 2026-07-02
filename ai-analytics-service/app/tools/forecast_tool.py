"""Forecast tool — wraps revenue + order forecast services."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def forecast_tool(db: "AsyncSession", restaurant_id: str, *, days: int = 7) -> dict[str, Any]:
    """Gather revenue and order-count forecasts for the next *days*."""
    from app.services.order_forecast_service import get_order_forecast
    from app.services.revenue_forecast_service import get_revenue_forecast

    result: dict[str, Any] = {}

    try:
        revenue = await get_revenue_forecast(db, restaurant_id, days=days)
        result["revenue_forecast"] = revenue if isinstance(revenue, dict) else None
    except Exception:
        logger.debug("forecast_tool: revenue forecast failed", exc_info=True)
        result["revenue_forecast"] = None

    try:
        orders = await get_order_forecast(db, restaurant_id, days=days)
        result["order_forecast"] = orders if isinstance(orders, dict) else None
    except Exception:
        logger.debug("forecast_tool: order forecast failed", exc_info=True)
        result["order_forecast"] = None

    return result
