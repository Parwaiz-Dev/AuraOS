"""Notification Handler — dispatches alerts on insight/inventory/drift events."""

from __future__ import annotations

import logging

from app.events.domain_events import (
    InsightGenerated,
    InventoryLow,
    ModelDriftDetected,
)
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(InsightGenerated)
async def handle_insight_notification(event: BaseEvent) -> None:
    """Evaluate insight thresholds and dispatch notifications."""
    if not isinstance(event, InsightGenerated):
        return

    total_alerts = event.anomaly_count + event.risk_count
    if total_alerts == 0:
        return

    logger.info(
        "InsightGenerated with %d potential alerts for restaurant=%s",
        total_alerts, event.restaurant_id,
    )


@subscribe(InventoryLow)
async def handle_inventory_low_notification(event: BaseEvent) -> None:
    if not isinstance(event, InventoryLow):
        return

    logger.warning(
        "InventoryLow alert: item=%s stock=%d reorder_level=%d restaurant=%s",
        event.item_name, event.current_stock, event.reorder_level, event.restaurant_id,
    )


@subscribe(ModelDriftDetected)
async def handle_drift_notification(event: BaseEvent) -> None:
    if not isinstance(event, ModelDriftDetected):
        return

    logger.warning(
        "ModelDriftDetected: model=%s restaurant=%s issues=%s",
        event.model_name, event.restaurant_id, event.issues,
    )
