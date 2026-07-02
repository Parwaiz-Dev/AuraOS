"""
Predictor for Revenue Forecast.

Uses a pre-trained Prophet model (loaded lazily) to generate revenue forecasts
for a given horizon.  Returns the same structure expected by the API:
{forecast, trend, growthPercentage, confidence}.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import pandas as pd

from app.ml.revenue_forecast.model_manager import get_model

if TYPE_CHECKING:
    from prophet import Prophet

logger = logging.getLogger(__name__)


def _determine_trend(forecast_df: pd.DataFrame) -> str:
    """Heuristic: compare first-half average to second-half average."""
    if len(forecast_df) < 2:
        return "stable"
    mid = len(forecast_df) // 2
    first_half = forecast_df["yhat"].iloc[:mid].mean()
    second_half = forecast_df["yhat"].iloc[mid:].mean()
    if second_half > first_half * 1.02:
        return "upward"
    if second_half < first_half * 0.98:
        return "downward"
    return "stable"


def _compute_growth(forecast_df: pd.DataFrame) -> float:
    """Percentage growth from first to last forecast point."""
    if len(forecast_df) < 2:
        return 0.0
    first = forecast_df["yhat"].iloc[0]
    last = forecast_df["yhat"].iloc[-1]
    if first == 0:
        return 0.0
    return round(((last - first) / first) * 100, 2)


def _compute_confidence(forecast_df: pd.DataFrame) -> float:
    """Average of (1 - (yhat_upper - yhat_lower) / yhat) across all points."""
    if "yhat_upper" not in forecast_df.columns or "yhat_lower" not in forecast_df.columns:
        return 0.85  # default fallback
    ratios = (forecast_df["yhat_upper"] - forecast_df["yhat_lower"]) / forecast_df["yhat"].abs()
    # Avoid division by zero
    ratios = ratios[forecast_df["yhat"] != 0]
    if ratios.empty:
        return 0.85
    conf = 1.0 - ratios.mean()
    return round(max(0.0, min(1.0, float(conf))), 4)


async def predict_revenue(
    restaurant_id: str,
    *,
    days: int = 30,
    db: "AsyncSession | None" = None,
) -> dict | None:
    """
    Generate a revenue forecast for the next *days*.

    Returns a dict with the API response shape, or ``None`` if no model exists.
    """
    model: Prophet | None = get_model(restaurant_id)
    if model is None:
        logger.info("No cached model for restaurant %s; attempting auto-train", restaurant_id)
        if db is not None:
            from app.ml.revenue_forecast.trainer import train_revenue_forecast

            model = await train_revenue_forecast(db, restaurant_id)
        if model is None:
            return None

    # Build future dataframe
    future = model.make_future_dataframe(periods=days, freq="D")
    forecast = model.predict(future)

    # Slice to only the requested horizon
    forecast["ds"] = pd.to_datetime(forecast["ds"])
    today = pd.Timestamp(date.today())
    horizon = forecast[forecast["ds"] > today].head(days)

    forecast_points = []
    for _, row in horizon.iterrows():
        forecast_points.append({
            "date": row["ds"].strftime("%Y-%m-%d"),
            "revenue": round(float(row["yhat"]), 2),
            "lowerBound": round(float(row.get("yhat_lower", 0)), 2),
            "upperBound": round(float(row.get("yhat_upper", 0)), 2),
        })

    return {
        "forecast": forecast_points,
        "trend": _determine_trend(horizon),
        "growthPercentage": _compute_growth(horizon),
        "confidence": _compute_confidence(horizon),
    }