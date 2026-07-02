"""Model Registry — central registry for model lifecycle operations."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.model_registry.metadata import (
    MODEL_STATUS_ACTIVE,
    MODEL_STATUS_ARCHIVED,
    MODEL_STATUS_FAILED,
    MODEL_STATUS_TRAINING,
    create_metadata,
    get_metadata,
    list_all_metadata,
    save_metadata,
    set_training_status,
)
from app.model_registry.version_manager import (
    archive_old_versions,
    get_current_version,
    increment_version,
)

logger = logging.getLogger(__name__)

# All known model names
ALL_MODEL_NAMES = [
    "revenue_forecast",
    "order_forecast",
    "customer_segmentation",
    "recommendation_engine",
    "wait_time_prediction",
    "inventory_prediction",
]


def register_training_start(model_name: str, restaurant_id: str) -> str:
    """Mark model as TRAINING and return the next version number."""
    set_training_status(model_name, restaurant_id)
    return increment_version(model_name, restaurant_id)


def register_training_success(
    model_name: str,
    restaurant_id: str,
    version: str,
    training_rows: int,
    metrics: dict[str, Any],
) -> None:
    """Persist metadata for a successfully trained model."""
    entry = create_metadata(model_name, restaurant_id, version, training_rows, metrics)
    save_metadata(entry)
    archive_old_versions(model_name, restaurant_id)
    logger.info(
        "Model registered: %s v%s (restaurant=%s, rows=%d)",
        model_name, version, restaurant_id, training_rows,
    )


def register_training_failure(
    model_name: str,
    restaurant_id: str,
    error: str,
) -> None:
    """Mark model as FAILED."""
    from app.model_registry.metadata import set_failed_status

    set_failed_status(model_name, restaurant_id, error)
    logger.warning(
        "Model training failed: %s (restaurant=%s): %s",
        model_name, restaurant_id, error,
    )


def get_model_status(model_name: str, restaurant_id: str) -> str:
    """Return the status string for a model, or 'UNKNOWN'."""
    entry = get_metadata(model_name, restaurant_id)
    if entry is None:
        return "UNKNOWN"
    return entry.get("status", "UNKNOWN")


def get_all_models_summary() -> dict[str, Any]:
    """Return a summary of all models: total, healthy, failed, avg accuracy."""
    entries = list_all_metadata()
    total = len(entries)
    healthy = sum(1 for e in entries if e.get("status") == MODEL_STATUS_ACTIVE)
    failed = sum(1 for e in entries if e.get("status") == MODEL_STATUS_FAILED)
    accuracies = []
    for e in entries:
        metrics = e.get("metrics", {})
        acc = metrics.get("accuracy") or metrics.get("confidence")
        if acc is not None:
            accuracies.append(float(acc))
    avg_accuracy = round(sum(accuracies) / len(accuracies), 4) if accuracies else 0.0
    return {
        "totalModels": total,
        "healthyModels": healthy,
        "failedModels": failed,
        "averageAccuracy": avg_accuracy,
    }


def get_model_health_map() -> dict[str, str]:
    """Return a dict mapping model_name → health status across all restaurants.

    A model is 'healthy' if at least one ACTIVE version exists for any restaurant.
    """
    entries = list_all_metadata()
    health: dict[str, str] = {name: "no_model" for name in ALL_MODEL_NAMES}
    for entry in entries:
        model_name = entry.get("model_name", "")
        status = entry.get("status", "")
        if model_name in health and status == MODEL_STATUS_ACTIVE:
            health[model_name] = "healthy"
        elif model_name in health and status == MODEL_STATUS_FAILED and health[model_name] != "healthy":
            health[model_name] = "failed"
    return health


def mark_model_archived(model_name: str, restaurant_id: str, version: str) -> None:
    """Archive a specific model version."""
    entry = get_metadata(model_name, restaurant_id)
    if entry and entry.get("version") == version:
        entry["status"] = MODEL_STATUS_ARCHIVED
        entry["archived_at"] = datetime.now(timezone.utc).isoformat()
        save_metadata(entry)
        logger.info("Archived %s v%s (restaurant=%s)", model_name, version, restaurant_id)