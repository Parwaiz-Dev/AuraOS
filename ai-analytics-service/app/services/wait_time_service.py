"""Service layer for Wait Time Prediction — orchestrates XGBoost prediction."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_wait_time(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    active_orders: int | None = None,
    table_occupancy: float | None = None,
    kitchen_load: int | None = None,
) -> dict | None:
    """Return estimated wait time in minutes."""
    # Short TTL for wait time — it's real-time data
    cache_key = f"wait_time:{restaurant_id}"
    ttl = 60  # 1 minute

    if await is_redis_available():
        cached = await cache_get(cache_key)
        if cached is not None:
            return cached

    from app.ml.wait_time_prediction import predict_wait_time

    result = await predict_wait_time(
        restaurant_id,
        active_orders=active_orders,
        table_occupancy=table_occupancy,
        kitchen_load=kitchen_load,
        db=db,
    )

    if result is not None and await is_redis_available():
        await cache_set(cache_key, result, ttl=ttl)

    return result