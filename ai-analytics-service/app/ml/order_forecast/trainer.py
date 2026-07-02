"""Trainer for the Order Forecast Prophet model."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import pandas as pd

from app.ml.order_forecast.model_manager import save_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
_MIN_TRAINING_POINTS = 30


async def train_order_forecast(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    lookback_days: int = 365,
) -> "Prophet | None":
    """Train a Prophet model on daily order counts."""
    from app.repositories.forecast_repository import fetch_daily_order_counts

    rows = await fetch_daily_order_counts(
        db, restaurant_id,
        start_date=date.today() - timedelta(days=lookback_days),
        end_date=date.today(),
    )

    if len(rows) < _MIN_TRAINING_POINTS:
        logger.warning("Insufficient order data (restaurant=%s, rows=%d)", restaurant_id, len(rows))
        return None

    df = pd.DataFrame(rows)
    df.columns = ["ds", "y"]
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].astype(float)
    df = df[df["y"] >= 0]

    if len(df) < _MIN_TRAINING_POINTS:
        return None

    from prophet import Prophet  # type: ignore[import-untyped]

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
        seasonality_mode="additive",
    )
    model.fit(df)

    save_model(restaurant_id, model)
    logger.info("Order forecast model trained (restaurant=%s, points=%d)", restaurant_id, len(df))
    return model