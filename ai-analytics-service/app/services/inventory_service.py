"""Service layer for Inventory Prediction — orchestrates depletion date prediction."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_inventory_predictions(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    item_ids: list[str] | None = None,
) -> list[dict] | None:
    """Return inventory depletion predictions and reorder recommendations."""
    cache_key = (
        f"inventory:{restaurant_id}:"
        f"{':'.join(sorted(item_ids)) if item_ids else 'all'}"
    )
    ttl = settings.CACHE_TTL_SECONDS

    if await is_redis_available():
        cached = await cache_get(cache_key)
        if cached is not None:
            return cached

    from app.ml.inventory_prediction import predict_inventory

    result = await predict_inventory(restaurant_id, item_ids=item_ids, db=db)

    if result is not None and await is_redis_available():
        await cache_set(cache_key, result, ttl=ttl)

    return result