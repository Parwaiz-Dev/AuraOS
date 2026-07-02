"""Audit Handler — structured log for every event (audit trail)."""

from __future__ import annotations

import logging

from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger("audit")


@subscribe(BaseEvent)
async def audit_handler(event: BaseEvent) -> None:
    """Log every event as a structured audit entry."""
    logger.info(
        "AUDIT event=%s id=%s restaurant=%s status=%s",
        event.event_name,
        event.event_id,
        event.restaurant_id,
        event.status,
    )
