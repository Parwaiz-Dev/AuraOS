"""Metrics — aggregation helpers for the metrics endpoint.

Provides the data for GET /api/v1/metrics/models.
"""

from __future__ import annotations

from typing import Any

from app.model_registry.registry import get_all_models_summary
from app.monitoring.model_health import compute_model_health


def get_metrics() -> dict[str, Any]:
    """Return aggregated metrics for the models endpoint.

    Returns
    -------
    dict
        {
            "totalModels": int,
            "healthyModels": int,
            "failedModels": int,
            "averageAccuracy": float,
            "models": dict  # per-model health breakdown
        }
    """
    summary = get_all_models_summary()
    summary["models"] = compute_model_health()
    return summary