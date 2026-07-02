"""Predictor for Order Forecast — uses Prophet to predict future order counts."""

from __future__ import annotations

import logging
from datetime import date
from typing import TYPE_CHECKING

import pandas as pd

from app.ml.order_forecast.model_manager import get_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def predict_orders(
    restaurant_id: str,
    *,
    days: int = 30,
    db: "AsyncSession | None" = None,
) -> dict | None:
    """Generate order count forecast for the next *days*."""
    model = get_model(restaurant_id)
    if model is None:
        logger.info("No cached order forecast model for %s; attempting auto-train", restaurant_id)
        if db is not None:
            from app.ml.order_forecast.trainer import train_order_forecast

            model = await train_order_forecast(db, restaurant_id)
        if model is None:
            return None

    future = model.make_future_dataframe(periods=days, freq="D")
    forecast = model.predict(future)

    forecast["ds"] = pd.to_datetime(forecast["ds"])
    today = pd.Timestamp(date.today())
    horizon = forecast[forecast["ds"] > today].head(days)

    forecast_points = []
    for _, row in horizon.iterrows():
        forecast_points.append({
            "date": row["ds"].strftime("%Y-%m-%d"),
            "orders": max(0, round(float(row["yhat"]))),
            "lowerBound": max(0, round(float(row.get("yhat_lower", 0)))),
            "upperBound": max(0, round(float(row.get("yhat_upper", 0)))),
        })

    return {
        "forecast": forecast_points,
        "trend": _determine_trend(horizon),
        "growthPercentage": _compute_growth(horizon),
        "confidence": _compute_confidence(horizon),
    }


def _determine_trend(df: pd.DataFrame) -> str:
    if len(df) < 2:
        return "stable"
    mid = len(df) // 2
    first = df["yhat"].iloc[:mid].mean()
    second = df["yhat"].iloc[mid:].mean()
    if second > first * 1.02:
        return "upward"
    if second < first * 0.98:
        return "downward"
    return "stable"


def _compute_growth(df: pd.DataFrame) -> float:
    if len(df) < 2 or df["yhat"].iloc[0] == 0:
        return 0.0
    return round(((df["yhat"].iloc[-1] - df["yhat"].iloc[0]) / df["yhat"].iloc[0]) * 100, 2)


def _compute_confidence(df: pd.DataFrame) -> float:
    if "yhat_upper" not in df.columns or "yhat_lower" not in df.columns:
        return 0.85
    valid = df["yhat"] != 0
    if not valid.any():
        return 0.85
    ratios = (df["yhat_upper"][valid] - df["yhat_lower"][valid]) / df["yhat"][valid].abs()
    conf = 1.0 - ratios.mean()
    return round(max(0.0, min(1.0, float(conf))), 4)