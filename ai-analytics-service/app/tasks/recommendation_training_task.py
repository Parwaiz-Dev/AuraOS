"""Background task: Recommendation Engine training."""

from __future__ import annotations

import logging

from app.config.database import _async_session_factory
from app.model_registry.registry import (
    register_training_failure,
    register_training_start,
    register_training_success,
)

logger = logging.getLogger(__name__)


async def run_recommendation_training(restaurant_id: str) -> None:
    """Train the recommendation engine for a given restaurant."""
    model_name = "recommendation_engine"
    version = register_training_start(model_name, restaurant_id)

    try:
        async with _async_session_factory() as session:
            from app.ml.recommendation_engine.trainer import train_recommendations

            result = await train_recommendations(session, restaurant_id)
            if result is None:
                register_training_failure(model_name, restaurant_id, "Insufficient data")
                return

            total_rules = sum(len(v) for v in result.values())
            register_training_success(
                model_name, restaurant_id, version,
                training_rows=len(result),
                metrics={"rules": total_rules},
            )
    except Exception:
        logger.exception("Recommendation training failed for restaurant=%s", restaurant_id)
        register_training_failure(model_name, restaurant_id, "Training exception")