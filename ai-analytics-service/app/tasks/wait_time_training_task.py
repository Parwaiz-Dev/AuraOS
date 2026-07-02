"""Background task: Wait Time Prediction training."""

from __future__ import annotations

import logging

from app.config.database import _async_session_factory
from app.model_registry.registry import (
    register_training_failure,
    register_training_start,
    register_training_success,
)

logger = logging.getLogger(__name__)


async def run_wait_time_training(restaurant_id: str) -> None:
    """Train the wait time prediction model for a given restaurant."""
    model_name = "wait_time_prediction"
    version = register_training_start(model_name, restaurant_id)

    try:
        async with _async_session_factory() as session:
            from app.ml.wait_time_prediction.trainer import train_wait_time

            model = await train_wait_time(session, restaurant_id)
            if model is None:
                register_training_failure(model_name, restaurant_id, "Insufficient data")
                return

            metrics = {
                "n_estimators": model.n_estimators,
                "max_depth": model.max_depth,
            }
            register_training_success(
                model_name, restaurant_id, version,
                training_rows=0,  # XGBoost doesn't expose row count easily
                metrics=metrics,
            )
    except Exception:
        logger.exception("Wait time training failed for restaurant=%s", restaurant_id)
        register_training_failure(model_name, restaurant_id, "Training exception")