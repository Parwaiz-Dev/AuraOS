"""Model Registry Handler — reacts to model lifecycle events."""

from __future__ import annotations

import logging

from app.events.domain_events import ModelDriftDetected, ModelRetrained
from app.events.event import BaseEvent
from app.events.subscriber import subscribe

logger = logging.getLogger(__name__)


@subscribe(ModelRetrained)
async def handle_model_retrained(event: BaseEvent) -> None:
    if not isinstance(event, ModelRetrained):
        return

    logger.info(
        "ModelRetrained: model=%s version=%s restaurant=%s metrics=%s",
        event.model_name, event.version, event.restaurant_id, event.metrics,
    )


@subscribe(ModelDriftDetected)
async def handle_model_drift(event: BaseEvent) -> None:
    if not isinstance(event, ModelDriftDetected):
        return

    logger.warning(
        "ModelDriftDetected: model=%s restaurant=%s issues=%s",
        event.model_name, event.restaurant_id, event.issues,
    )
