"""Service layer for Customer Segmentation — orchestrates KMeans prediction."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_customer_segments(
    db: "AsyncSession",
    restaurant_id: str,
) -> list[dict] | None:
    """Return customer segments for all customers."""
    cache_key = f"segments:customers:{restaurant_id}"
    ttl = settings.CACHE_TTL_SECONDS

    if await is_redis_available():
        cached = await cache_get(cache_key)
        if cached is not None:
            return cached

    from app.ml.customer_segmentation import predict_segments

    result = await predict_segments(restaurant_id, db=db)

    if result is not None and await is_redis_available():
        await cache_set(cache_key, result, ttl=ttl)

    return result