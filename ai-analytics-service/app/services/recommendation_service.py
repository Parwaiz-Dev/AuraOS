"""Service layer for Recommendation Engine — orchestrates association rule prediction."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_recommendations(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    item_ids: list[str] | None = None,
    limit: int = 10,
) -> list[dict] | None:
    """Return recommended items based on association rules."""
    cache_key = (
        f"recommendations:{restaurant_id}:"
        f"{':'.join(sorted(item_ids)) if item_ids else 'global'}:{limit}"
    )
    ttl = settings.CACHE_TTL_SECONDS

    if await is_redis_available():
        cached = await cache_get(cache_key)
        if cached is not None:
            return cached

    from app.ml.recommendation_engine import predict_recommendations

    result = await predict_recommendations(restaurant_id, item_ids=item_ids, limit=limit, db=db)

    if result is not None and await is_redis_available():
        await cache_set(cache_key, result, ttl=ttl)

    return result