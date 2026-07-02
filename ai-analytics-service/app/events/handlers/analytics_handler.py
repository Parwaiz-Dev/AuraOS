"""Analytics Handler — reacts to order and forecast events for cache updates."""

from __future__ import annotations

import logging

from app.events.domain_events import (
    OrderCompleted,
    PaymentCompleted,
    RevenueForecastGenerated,
)
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(OrderCompleted)
async def handle_order_completed(event: BaseEvent) -> None:
    if not isinstance(event, OrderCompleted):
        return

    logger.info(
        "OrderCompleted: order=%s restaurant=%s amount=%.2f",
        event.order_id, event.restaurant_id, event.total_amount,
    )

    try:
        from app.config.redis_client import cache_delete, is_redis_available

        if await is_redis_available():
            await cache_delete(f"forecast:revenue:{event.restaurant_id}:30")
            await cache_delete(f"forecast:orders:{event.restaurant_id}:30")
    except Exception:
        logger.debug("Failed to invalidate caches on OrderCompleted", exc_info=True)


@subscribe(PaymentCompleted)
async def handle_payment_completed(event: BaseEvent) -> None:
    if not isinstance(event, PaymentCompleted):
        return

    logger.info(
        "PaymentCompleted: payment=%s order=%s amount=%.2f method=%s",
        event.payment_id, event.order_id, event.amount, event.method,
    )


@subscribe(RevenueForecastGenerated)
async def handle_revenue_forecast(event: BaseEvent) -> None:
    if not isinstance(event, RevenueForecastGenerated):
        return

    logger.info(
        "RevenueForecastGenerated: restaurant=%s days=%d confidence=%.2f",
        event.restaurant_id, event.forecast_days, event.confidence,
    )
