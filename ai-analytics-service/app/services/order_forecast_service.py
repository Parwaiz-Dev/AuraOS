"""Service layer for Order Forecast — orchestrates ML prediction with repository data."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_order_forecast(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    days: int = 30,
) -> dict | None:
    """Return order count forecast for the next *days*."""
    cache_key = f"forecast:orders:{restaurant_id}:{days}"
    ttl = settings.CACHE_TTL_SECONDS

    if await is_redis_available():
        cached = await cache_get(cache_key)
        if cached is not None:
            return cached

    from app.ml.order_forecast import predict_orders

    result = await predict_orders(restaurant_id, days=days, db=db)

    if result is not None and await is_redis_available():
        await cache_set(cache_key, result, ttl=ttl)

    return result