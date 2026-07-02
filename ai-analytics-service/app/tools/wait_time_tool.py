"""Wait-time tool — wraps the wait-time prediction service + peak hours."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def wait_time_tool(db: "AsyncSession", restaurant_id: str) -> dict[str, Any]:
    """Gather current wait-time estimate and peak-hour context for staffing decisions."""
    from app.services.revenue_service import get_peak_hours
    from app.services.wait_time_service import get_wait_time

    result: dict[str, Any] = {}

    try:
        wait = await get_wait_time(db, restaurant_id)
        if isinstance(wait, dict):
            factors = wait.get("factors") or {}
            result["wait_time"] = {
                "estimated_wait_minutes": wait.get("estimatedWaitMinutes"),
                "confidence": wait.get("confidence"),
                "kitchen_load": factors.get("kitchenLoad"),
                "active_orders": factors.get("activeOrders"),
                "table_occupancy": factors.get("tableOccupancy"),
            }
        else:
            result["wait_time"] = None
    except Exception:
        logger.debug("wait_time_tool: wait time failed", exc_info=True)
        result["wait_time"] = None

    try:
        peak = await get_peak_hours(db, restaurant_id)
        result["peak_hours"] = [
            {"hour": p.get("hour"), "orders": p.get("orderCount")} for p in (peak or [])[:6]
        ]
    except Exception:
        logger.debug("wait_time_tool: peak hours failed", exc_info=True)
        result["peak_hours"] = []

    return result
