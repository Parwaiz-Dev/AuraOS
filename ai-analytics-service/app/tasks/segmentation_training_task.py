"""Background task: Customer Segmentation training."""

from __future__ import annotations

import logging

from app.config.database import _async_session_factory
from app.model_registry.registry import (
    register_training_failure,
    register_training_start,
    register_training_success,
)

logger = logging.getLogger(__name__)


async def run_segmentation_training(restaurant_id: str) -> None:
    """Train the customer segmentation model for a given restaurant."""
    model_name = "customer_segmentation"
    version = register_training_start(model_name, restaurant_id)

    try:
        async with _async_session_factory() as session:
            from app.ml.customer_segmentation.trainer import train_customer_segmentation

            result = await train_customer_segmentation(session, restaurant_id)
            if result is None:
                register_training_failure(model_name, restaurant_id, "Insufficient data")
                return

            label_map = result.get("label_map", {})
            register_training_success(
                model_name, restaurant_id, version,
                training_rows=len(label_map),
                metrics={"clusters": 5},
            )
    except Exception:
        logger.exception("Segmentation training failed for restaurant=%s", restaurant_id)
        register_training_failure(model_name, restaurant_id, "Training exception")