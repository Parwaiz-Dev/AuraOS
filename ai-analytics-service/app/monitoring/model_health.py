"""Model Health — computes health status per model name.

A model is 'healthy' if at least one ACTIVE version exists for any restaurant.
A model is 'failed' if there are FAILED entries but no ACTIVE ones.
A model is 'no_model' if it has never been trained.
"""

from __future__ import annotations

from typing import Any

from app.model_registry.metadata import list_all_metadata
from app.model_registry.registry import ALL_MODEL_NAMES


def compute_model_health() -> dict[str, dict[str, Any]]:
    """Return detailed health status for each model name.

    Returns
    -------
    dict
        { model_name: { "status": "healthy"|"failed"|"no_model", "active_count": int, "failed_count": int } }
    """
    entries = list_all_metadata()

    # Initialize health for all known models
    health: dict[str, dict[str, Any]] = {}
    for name in ALL_MODEL_NAMES:
        health[name] = {
            "status": "no_model",
            "active_count": 0,
            "failed_count": 0,
            "total_versions": 0,
        }

    for entry in entries:
        model_name = entry.get("model_name", "")
        if model_name not in health:
            continue
        status = entry.get("status", "")
        health[model_name]["total_versions"] += 1
        if status == "ACTIVE":
            health[model_name]["active_count"] += 1
        elif status == "FAILED":
            health[model_name]["failed_count"] += 1

    # Determine overall status
    for name, info in health.items():
        if info["active_count"] > 0:
            info["status"] = "healthy"
        elif info["failed_count"] > 0:
            info["status"] = "failed"
        else:
            info["status"] = "no_model"

    return health


def get_model_health_summary(model_name: str) -> dict[str, Any] | None:
    """Return health summary for a single model, or None if unknown."""
    all_health = compute_model_health()
    return all_health.get(model_name)