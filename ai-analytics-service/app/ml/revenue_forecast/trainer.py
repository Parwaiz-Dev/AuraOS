"""
Trainer for the Revenue Forecast Prophet model.

Trains a new Prophet model on historical daily revenue data and persists it
via `model_manager.save_model()`.  This is called explicitly (e.g. by a Celery
task or CLI) — NEVER on every request.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import pandas as pd

from app.ml.revenue_forecast.model_manager import save_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Minimum number of data points required for a meaningful forecast
_MIN_TRAINING_POINTS = 30


async def train_revenue_forecast(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    lookback_days: int = 365,
) -> "Prophet | None":
    """
    Train a Prophet model on daily revenue history for *restaurant_id*.

    Parameters
    ----------
    db : AsyncSession
        Read-only database session.
    restaurant_id : str
        Tenant identifier.
    lookback_days : int
        How many days of history to pull (default 365).

    Returns
    -------
    Prophet | None
        The trained model, or ``None`` if there is insufficient data.
    """
    from app.repositories.forecast_repository import fetch_daily_revenue_history

    rows = await fetch_daily_revenue_history(
        db, restaurant_id,
        start_date=date.today() - timedelta(days=lookback_days),
        end_date=date.today(),
    )

    if len(rows) < _MIN_TRAINING_POINTS:
        logger.warning(
            "Insufficient data for revenue forecast training (restaurant=%s, rows=%d)",
            restaurant_id, len(rows),
        )
        return None

    df = pd.DataFrame(rows)
    df.columns = ["ds", "y"]
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].astype(float)

    # Remove any rows with zero/negative revenue (refunds or data errors)
    df = df[df["y"] > 0]

    if len(df) < _MIN_TRAINING_POINTS:
        logger.warning("Not enough positive-revenue rows after filtering")
        return None

    # Prophet requires the 'ds' (date) and 'y' (value) columns
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
    logger.info(
        "Revenue forecast model trained successfully (restaurant=%s, points=%d)",
        restaurant_id, len(df),
    )
    return model