"""
Dashboard service — aggregates KPIs, chart data, and top items.

Uses Redis caching with a TTL of 300 seconds and graceful fallback
when Redis is unavailable.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.repositories import dashboard_repository, top_items_repository

logger = logging.getLogger(__name__)

DASHBOARD_CACHE_TTL = 300  # 5 minutes


async def get_dashboard(
    db: AsyncSession,
    restaurant_id: UUID,
) -> dict:
    """Return the full dashboard payload, served from cache when possible."""
    cache_key = f"dashboard:{restaurant_id}"

    # Try cache first
    cached = await cache_get(cache_key)
    if cached is not None:
        logger.debug("Dashboard cache hit for %s", restaurant_id)
        return cached

    # Build from scratch
    logger.debug("Dashboard cache miss — building for %s", restaurant_id)

    try:
        kpis = await dashboard_repository.fetch_today_kpis(db, restaurant_id)
        active_customers = await dashboard_repository.fetch_active_customers(db, restaurant_id)
        repeat_customers = await dashboard_repository.fetch_repeat_customers(db, restaurant_id)
        peak_hour = await dashboard_repository.fetch_peak_hour_today(db, restaurant_id)
        top_item = await dashboard_repository.fetch_top_selling_item_today(db, restaurant_id)
        hourly = await dashboard_repository.fetch_hourly_sales_today(db, restaurant_id)
        weekly = await dashboard_repository.fetch_weekly_sales(db, restaurant_id)
        monthly = await dashboard_repository.fetch_monthly_sales(db, restaurant_id)
        top_items = await top_items_repository.fetch_top_items(db, restaurant_id, limit=5)

        response = {
            "totalOrders": kpis["totalOrders"],
            "completedOrders": kpis["completedOrders"],
            "cancelledOrders": kpis["cancelledOrders"],
            "totalRevenue": kpis["totalRevenue"],
            "averageOrderValue": kpis["averageOrderValue"],
            "activeCustomers": active_customers,
            "repeatCustomers": repeat_customers,
            "peakHour": peak_hour,
            "topSellingItem": top_item,
            "hourlySales": hourly,
            "weeklySales": weekly,
            "monthlySales": monthly,
            "topItems": top_items,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Cache the result (best-effort)
        await cache_set(cache_key, response, ttl=DASHBOARD_CACHE_TTL)

        return response

    except Exception as exc:
        logger.exception("Failed to build dashboard for %s: %s", restaurant_id, exc)
        raise