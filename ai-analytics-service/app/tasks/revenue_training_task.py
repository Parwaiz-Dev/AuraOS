"""Background task: Revenue Forecast training.

Called by the scheduler — NEVER from a request handler.
"""

from __future__ import annotations

import logging

from app.config.database import _async_session_factory
from app.model_registry.registry import (
    register_training_failure,
    register_training_start,
    register_training_success,
)

logger = logging.getLogger(__name__)


async def run_revenue_training(restaurant_id: str) -> None:
    """Train the revenue forecast model for a given restaurant."""
    model_name = "revenue_forecast"
    version = register_training_start(model_name, restaurant_id)

    try:
        async with _async_session_factory() as session:
            from app.ml.revenue_forecast.trainer import train_revenue_forecast

            model = await train_revenue_forecast(session, restaurant_id)
            if model is None:
                register_training_failure(model_name, restaurant_id, "Insufficient data")
                return

            metrics = {
                "training_rows": len(model.history) if model.history else 0,
            }
            register_training_success(
                model_name, restaurant_id, version,
                training_rows=metrics["training_rows"],
                metrics=metrics,
            )
    except Exception:
        logger.exception("Revenue forecast training failed for restaurant=%s", restaurant_id)
        register_training_failure(model_name, restaurant_id, "Training exception")