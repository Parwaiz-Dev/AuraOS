"""Monitoring — drift detection for trained ML models.

Checks MAPE, RMSE, and prediction variance against thresholds
defined in settings.  Flags unhealthy models when drift is detected.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.config.settings import settings
from app.model_registry.metadata import add_drift_check, get_metadata

logger = logging.getLogger(__name__)


def _compute_mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Compute Mean Absolute Percentage Error.

    Returns 0.0 if actual contains zeros (to avoid division by zero).
    """
    mask = actual != 0
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])))


def _compute_rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Compute Root Mean Squared Error."""
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def _compute_prediction_variance(predictions: np.ndarray) -> float:
    """Compute the variance of predictions as a measure of stability."""
    if len(predictions) < 2:
        return 0.0
    return float(np.var(predictions))


def check_drift(
    model_name: str,
    restaurant_id: str,
    actual: list[float],
    predicted: list[float],
    baseline_rmse: float | None = None,
) -> dict[str, Any]:
    """Run drift detection checks and update model metadata.

    Parameters
    ----------
    model_name : str
        The model identifier (e.g., 'revenue_forecast').
    restaurant_id : str
        The restaurant identifier.
    actual : list[float]
        Ground truth values.
    predicted : list[float]
        Model predictions.
    baseline_rmse : float | None
        Historical baseline RMSE for comparison. If None, RMSE multiplier
        check is skipped.

    Returns
    -------
    dict
        { "healthy": bool, "issues": list[str], "metrics": dict }
    """
    if len(actual) == 0 or len(predicted) == 0:
        return {"healthy": True, "issues": [], "metrics": {}}

    actual_arr = np.array(actual, dtype=np.float64)
    predicted_arr = np.array(predicted, dtype=np.float64)

    mape = _compute_mape(actual_arr, predicted_arr)
    rmse = _compute_rmse(actual_arr, predicted_arr)
    variance = _compute_prediction_variance(predicted_arr)

    issues: list[str] = []

    # Check MAPE threshold
    if mape > settings.DRIFT_MAPE_THRESHOLD:
        issues.append(f"MAPE ({mape:.4f}) exceeds threshold ({settings.DRIFT_MAPE_THRESHOLD})")

    # Check RMSE multiplier vs baseline
    if baseline_rmse is not None and baseline_rmse > 0:
        if rmse > baseline_rmse * settings.DRIFT_RMSE_MULTIPLIER:
            issues.append(
                f"RMSE ({rmse:.4f}) exceeds {settings.DRIFT_RMSE_MULTIPLIER}x baseline ({baseline_rmse:.4f})"
            )

    # Check prediction variance
    if variance > settings.DRIFT_VARIANCE_THRESHOLD:
        issues.append(f"Prediction variance ({variance:.4f}) exceeds threshold ({settings.DRIFT_VARIANCE_THRESHOLD})")

    healthy = len(issues) == 0

    # Record drift check in metadata
    metadata = get_metadata(model_name, restaurant_id)
    if metadata is not None:
        add_drift_check(
            model_name,
            restaurant_id,
            {
                "healthy": healthy,
                "mape": round(mape, 4),
                "rmse": round(rmse, 4),
                "variance": round(variance, 4),
                "issues": issues,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    if not healthy:
        logger.warning(
            "Drift detected for %s (restaurant=%s): %s",
            model_name, restaurant_id, "; ".join(issues),
        )

    return {
        "healthy": healthy,
        "issues": issues,
        "metrics": {
            "mape": round(mape, 4),
            "rmse": round(rmse, 4),
            "prediction_variance": round(variance, 4),
        },
    }