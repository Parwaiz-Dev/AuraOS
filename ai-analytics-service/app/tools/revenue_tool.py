"""Revenue tool — wraps revenue analytics + forecast services."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def revenue_tool(db: "AsyncSession", restaurant_id: str) -> dict[str, Any]:
    """Gather revenue analytics, trends, and a short forecast.

    Returns a compact dict with daily/weekly revenue, trends, peak hours, and a
    7-day forecast. Each sub-call is defensive: a failure in one section does not
    fail the whole tool.
    """
    from app.services.revenue_service import (
        get_daily_revenue,
        get_peak_hours,
        get_revenue_trends,
        get_weekly_revenue,
    )
    from app.services.revenue_forecast_service import get_revenue_forecast

    result: dict[str, Any] = {}

    try:
        result["daily_recent"] = (await get_daily_revenue(db, restaurant_id, limit=7)) or []
    except Exception:
        logger.debug("revenue_tool: daily failed", exc_info=True)
        result["daily_recent"] = []

    try:
        result["weekly_recent"] = (await get_weekly_revenue(db, restaurant_id, limit=4)) or []
    except Exception:
        logger.debug("revenue_tool: weekly failed", exc_info=True)
        result["weekly_recent"] = []

    try:
        result["trends"] = await get_revenue_trends(db, restaurant_id, periods=6)
    except Exception:
        logger.debug("revenue_tool: trends failed", exc_info=True)
        result["trends"] = {}

    try:
        result["peak_hours"] = (await get_peak_hours(db, restaurant_id))[:6]
    except Exception:
        logger.debug("revenue_tool: peak_hours failed", exc_info=True)
        result["peak_hours"] = []

    try:
        forecast = await get_revenue_forecast(db, restaurant_id, days=7)
        result["forecast"] = forecast if isinstance(forecast, dict) else None
    except Exception:
        logger.debug("revenue_tool: forecast failed", exc_info=True)
        result["forecast"] = None

    return result
