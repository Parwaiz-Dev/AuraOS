"""Inventory Handler — reacts to inventory events."""

from __future__ import annotations

import logging

from app.events.domain_events import InventoryLow, InventoryUpdated
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(InventoryLow)
async def handle_inventory_low(event: BaseEvent) -> None:
    if not isinstance(event, InventoryLow):
        return

    logger.warning(
        "InventoryLow: item=%s (%s) stock=%d reorder_level=%d restaurant=%s",
        event.item_id, event.item_name, event.current_stock,
        event.reorder_level, event.restaurant_id,
    )


@subscribe(InventoryUpdated)
async def handle_inventory_updated(event: BaseEvent) -> None:
    if not isinstance(event, InventoryUpdated):
        return

    logger.info(
        "InventoryUpdated: item=%s %d→%d restaurant=%s",
        event.item_id, event.quantity_before, event.quantity_after,
        event.restaurant_id,
    )

    try:
        from app.config.redis_client import cache_delete, is_redis_available

        if await is_redis_available():
            await cache_delete(f"inventory:{event.restaurant_id}:all")
    except Exception:
        logger.debug("Failed to invalidate inventory cache", exc_info=True)
