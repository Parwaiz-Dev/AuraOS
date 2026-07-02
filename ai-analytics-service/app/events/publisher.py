"""Publisher — convenience module-level functions for event publishing."""

from __future__ import annotations

import logging
from typing import Any

from app.events.event import BaseEvent
from app.events.event_bus import get_event_bus

logger = logging.getLogger(__name__)


async def publish(event: BaseEvent) -> None:
    """Publish an event (fire-and-forget)."""
    try:
        bus = get_event_bus()
        await bus.publish(event)
    except Exception:
        logger.debug("Event publish failed for %s", event.event_name, exc_info=True)


async def publish_and_collect(event: BaseEvent) -> list[Any]:
    """Publish an event and collect results from all handlers."""
    try:
        bus = get_event_bus()
        return await bus.publish_and_collect(event)
    except Exception:
        logger.debug("Event publish_and_collect failed for %s", event.event_name, exc_info=True)
        return []
