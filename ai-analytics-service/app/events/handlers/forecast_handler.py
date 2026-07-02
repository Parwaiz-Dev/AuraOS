"""Forecast Handler — reacts to forecast and order events."""

from __future__ import annotations

import logging

from app.events.domain_events import OrderCompleted, RevenueForecastGenerated
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(RevenueForecastGenerated)
async def handle_forecast_generated(event: BaseEvent) -> None:
    if not isinstance(event, RevenueForecastGenerated):
        return

    logger.info(
        "RevenueForecast ready: restaurant=%s days=%d confidence=%.2f",
        event.restaurant_id, event.forecast_days, event.confidence,
    )


@subscribe(OrderCompleted)
async def handle_order_for_forecast(event: BaseEvent) -> None:
    """Invalidate forecast caches when new orders complete."""
    if not isinstance(event, OrderCompleted):
        return

    try:
        from app.config.redis_client import cache_delete, is_redis_available

        if await is_redis_available():
            for days in (7, 14, 30, 60, 90):
                await cache_delete(f"forecast:revenue:{event.restaurant_id}:{days}")
                await cache_delete(f"forecast:orders:{event.restaurant_id}:{days}")
    except Exception:
        logger.debug("Failed to invalidate forecast caches", exc_info=True)
