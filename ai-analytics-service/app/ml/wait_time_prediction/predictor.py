"""Predictor for Wait Time — XGBoost-based wait time estimation."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

from app.ml.wait_time_prediction.model_manager import FEATURE_NAMES, get_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def predict_wait_time(
    restaurant_id: str,
    *,
    active_orders: int | None = None,
    table_occupancy: float | None = None,
    kitchen_load: int | None = None,
    db: "AsyncSession | None" = None,
) -> dict | None:
    """
    Predict wait time in minutes.

    If inputs are not provided, they are fetched live from the database.
    """
    bundled = get_model(restaurant_id)
    if bundled is None:
        logger.info("No cached wait time model for %s; attempting auto-train", restaurant_id)
        if db is not None:
            from app.ml.wait_time_prediction.trainer import train_wait_time

            await train_wait_time(db, restaurant_id)
            bundled = get_model(restaurant_id)
        if bundled is None:
            return None

    model = bundled["model"]

    now = datetime.now()
    hour = now.hour
    day_of_week = now.weekday()  # 0=Monday
    is_weekend = 1 if day_of_week >= 5 else 0

    if active_orders is None or table_occupancy is None or kitchen_load is None:
        if db is None:
            return None
        from app.repositories.wait_time_repository import fetch_current_kitchen_metrics

        metrics = await fetch_current_kitchen_metrics(db, restaurant_id)
        if metrics:
            active_orders = active_orders or metrics.get("active_orders", 0)
            table_occupancy = table_occupancy or metrics.get("table_occupancy", 0.0)
            kitchen_load = kitchen_load or metrics.get("kitchen_load", 0)

    # Build feature vector
    features = pd.DataFrame([[
        active_orders or 0,
        table_occupancy or 0.0,
        kitchen_load or 0,
        hour,
        day_of_week,
        is_weekend,
    ]], columns=FEATURE_NAMES)

    prediction = model.predict(features)[0]
    wait_minutes = round(max(0, float(prediction)), 1)

    return {
        "estimatedWaitMinutes": wait_minutes,
        "confidence": 0.85,
        "factors": {
            "activeOrders": active_orders or 0,
            "tableOccupancy": table_occupancy or 0.0,
            "kitchenLoad": kitchen_load or 0,
        },
        "generatedAt": now.isoformat(),
    }