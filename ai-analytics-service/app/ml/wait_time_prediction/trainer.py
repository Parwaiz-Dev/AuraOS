"""Trainer for Wait Time Prediction — XGBoost Regressor."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from app.ml.wait_time_prediction.model_manager import save_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
_MIN_SAMPLES = 30


FEATURE_NAMES = [
    "active_orders",
    "table_occupancy",
    "kitchen_load",
    "hour",
    "day_of_week",
    "is_weekend",
]


async def train_wait_time(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    lookback_days: int = 90,
) -> "XGBRegressor | None":
    """Train an XGBoost model to predict food preparation wait times."""
    from app.repositories.wait_time_repository import fetch_wait_time_training_data

    rows = await fetch_wait_time_training_data(
        db, restaurant_id,
        start_date=date.today() - timedelta(days=lookback_days),
        end_date=date.today(),
    )

    if len(rows) < _MIN_SAMPLES:
        logger.warning("Insufficient wait time training data (n=%d)", len(rows))
        return None

    df = pd.DataFrame(rows)
    # Expected columns: active_orders, table_occupancy, kitchen_load, hour, day_of_week, is_weekend, actual_wait_minutes
    X = df[FEATURE_NAMES].fillna(0)
    y = df["actual_wait_minutes"].fillna(0).clip(lower=0)

    if len(X) < _MIN_SAMPLES:
        return None

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    save_model(restaurant_id, model, FEATURE_NAMES)
    logger.info(
        "Wait time model trained (restaurant=%s, samples=%d)",
        restaurant_id, len(df),
    )
    return model