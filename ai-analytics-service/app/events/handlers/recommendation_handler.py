"""Recommendation Handler — reacts to recommendation and order events."""

from __future__ import annotations

import logging

from app.events.domain_events import OrderCompleted, RecommendationGenerated
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(RecommendationGenerated)
async def handle_recommendation_generated(event: BaseEvent) -> None:
    if not isinstance(event, RecommendationGenerated):
        return

    logger.info(
        "RecommendationGenerated: restaurant=%s items=%d",
        event.restaurant_id, event.item_count,
    )


@subscribe(OrderCompleted)
async def handle_order_for_recommendations(event: BaseEvent) -> None:
    """Invalidate recommendation cache when new orders complete."""
    if not isinstance(event, OrderCompleted):
        return

    try:
        from app.config.redis_client import cache_delete, is_redis_available

        if await is_redis_available():
            await cache_delete(f"recommendations:{event.restaurant_id}:global:10")
    except Exception:
        logger.debug("Failed to invalidate recommendation cache", exc_info=True)
