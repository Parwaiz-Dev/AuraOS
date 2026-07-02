"""Background task: Inventory Prediction training."""

from __future__ import annotations

import logging

from app.config.database import _async_session_factory
from app.model_registry.registry import (
    register_training_failure,
    register_training_start,
    register_training_success,
)

logger = logging.getLogger(__name__)


async def run_inventory_training(restaurant_id: str) -> None:
    """Train the inventory prediction model for a given restaurant."""
    model_name = "inventory_prediction"
    version = register_training_start(model_name, restaurant_id)

    try:
        async with _async_session_factory() as session:
            from app.ml.inventory_prediction.trainer import train_inventory_prediction

            result = await train_inventory_prediction(session, restaurant_id)
            if result is None:
                register_training_failure(model_name, restaurant_id, "Insufficient data")
                return

            register_training_success(
                model_name, restaurant_id, version,
                training_rows=len(result),
                metrics={"items_tracked": len(result)},
            )
    except Exception:
        logger.exception("Inventory prediction training failed for restaurant=%s", restaurant_id)
        register_training_failure(model_name, restaurant_id, "Training exception")