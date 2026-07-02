"""Workflow scheduler — event-driven workflow triggers."""

from __future__ import annotations

import logging

from app.events.domain_events import (
    InsightGenerated,
    InventoryLow,
    ModelDriftDetected,
    OrderCompleted,
)
from app.events.event import BaseEvent
from app.events.subscriber import subscribe
from app.workflows.workflow_engine import get_workflow_engine

logger = logging.getLogger(__name__)


@subscribe(OrderCompleted)
async def trigger_analytics_workflow(event: BaseEvent) -> None:
    if not isinstance(event, OrderCompleted):
        return
    try:
        engine = get_workflow_engine()
        await engine.run(
            "daily_analytics",
            restaurant_id=event.restaurant_id,
            metadata={"trigger": "OrderCompleted", "order_id": event.order_id},
        )
    except Exception:
        logger.debug("Analytics workflow trigger failed", exc_info=True)


@subscribe(InventoryLow)
async def trigger_inventory_workflow(event: BaseEvent) -> None:
    if not isinstance(event, InventoryLow):
        return
    try:
        engine = get_workflow_engine()
        await engine.run(
            "inventory_workflow",
            restaurant_id=event.restaurant_id,
            metadata={"trigger": "InventoryLow", "item_id": event.item_id},
        )
    except Exception:
        logger.debug("Inventory workflow trigger failed", exc_info=True)


@subscribe(ModelDriftDetected)
async def trigger_retraining_workflow(event: BaseEvent) -> None:
    if not isinstance(event, ModelDriftDetected):
        return
    try:
        engine = get_workflow_engine()
        await engine.run(
            "model_retraining",
            restaurant_id=event.restaurant_id,
            metadata={"trigger": "ModelDriftDetected", "model_name": event.model_name},
        )
    except Exception:
        logger.debug("Retraining workflow trigger failed", exc_info=True)


@subscribe(InsightGenerated)
async def trigger_notification_workflow(event: BaseEvent) -> None:
    if not isinstance(event, InsightGenerated):
        return
    total_alerts = event.anomaly_count + event.risk_count
    if total_alerts == 0:
        return
    try:
        engine = get_workflow_engine()
        await engine.run(
            "weekly_report",
            restaurant_id=event.restaurant_id,
            metadata={"trigger": "InsightGenerated"},
        )
    except Exception:
        logger.debug("Notification workflow trigger failed", exc_info=True)
