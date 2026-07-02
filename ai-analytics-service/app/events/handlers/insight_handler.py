"""Insight Handler — reacts to InsightGenerated events."""

from __future__ import annotations

import logging

from app.events.domain_events import InsightGenerated
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(InsightGenerated)
async def handle_insight_generated(event: BaseEvent) -> None:
    """React to a generated insight — store and evaluate notification triggers."""
    if not isinstance(event, InsightGenerated):
        return

    logger.info(
        "InsightGenerated for restaurant=%s: anomalies=%d trends=%d opportunities=%d risks=%d",
        event.restaurant_id,
        event.anomaly_count,
        event.trend_count,
        event.opportunity_count,
        event.risk_count,
    )
