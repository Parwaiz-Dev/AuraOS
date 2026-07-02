"""Model Registry — metadata tracking for trained ML models."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config.settings import settings

# ── Registry directory ──────────────────────────────────────────────────────────

_registry_dir = Path(settings.MODEL_REGISTRY_DIR)


def _ensure_registry_dir() -> None:
    _registry_dir.mkdir(parents=True, exist_ok=True)


def _metadata_path(model_name: str, restaurant_id: str) -> Path:
    _ensure_registry_dir()
    return _registry_dir / f"{model_name}_{restaurant_id}.json"


# ── Model statuses ──────────────────────────────────────────────────────────────

MODEL_STATUS_ACTIVE = "ACTIVE"
MODEL_STATUS_TRAINING = "TRAINING"
MODEL_STATUS_FAILED = "FAILED"
MODEL_STATUS_ARCHIVED = "ARCHIVED"


# ── Metadata helpers ────────────────────────────────────────────────────────────


def create_metadata(
    model_name: str,
    restaurant_id: str,
    version: str,
    training_rows: int,
    metrics: dict[str, Any],
) -> dict[str, Any]:
    """Create a new metadata entry for a trained model."""
    return {
        "model_name": model_name,
        "restaurant_id": restaurant_id,
        "version": version,
        "status": MODEL_STATUS_ACTIVE,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": training_rows,
        "metrics": metrics,
        "drift_checks": [],
    }


def set_training_status(model_name: str, restaurant_id: str) -> None:
    """Mark a model as TRAINING before training begins."""
    import json

    path = _metadata_path(model_name, restaurant_id)
    entry = {
        "model_name": model_name,
        "restaurant_id": restaurant_id,
        "version": "pending",
        "status": MODEL_STATUS_TRAINING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": 0,
        "metrics": {},
        "drift_checks": [],
    }
    path.write_text(json.dumps(entry, indent=2), encoding="utf-8")


def set_failed_status(model_name: str, restaurant_id: str, error: str) -> None:
    """Mark a model as FAILED after training error."""
    import json

    path = _metadata_path(model_name, restaurant_id)
    if path.exists():
        raw = json.loads(path.read_text(encoding="utf-8"))
    else:
        raw = {}
    raw["status"] = MODEL_STATUS_FAILED
    raw["error"] = error
    raw["failed_at"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(raw, indent=2), encoding="utf-8")


def get_metadata(model_name: str, restaurant_id: str) -> dict[str, Any] | None:
    """Read metadata for a specific model × restaurant."""
    import json

    path = _metadata_path(model_name, restaurant_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_metadata(entry: dict[str, Any]) -> None:
    """Persist a metadata entry to disk."""
    import json

    path = _metadata_path(entry["model_name"], entry["restaurant_id"])
    path.write_text(json.dumps(entry, indent=2), encoding="utf-8")


def list_all_metadata() -> list[dict[str, Any]]:
    """List all metadata entries across all models and restaurants."""
    import json

    _ensure_registry_dir()
    entries: list[dict[str, Any]] = []
    for f in _registry_dir.glob("*.json"):
        try:
            entries.append(json.loads(f.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return entries


def add_drift_check(
    model_name: str,
    restaurant_id: str,
    check_result: dict[str, Any],
) -> None:
    """Record a drift check result in the model's metadata."""
    import json

    path = _metadata_path(model_name, restaurant_id)
    if not path.exists():
        return
    entry = json.loads(path.read_text(encoding="utf-8"))
    entry.setdefault("drift_checks", []).append(check_result)
    # Keep last 20 drift checks
    entry["drift_checks"] = entry["drift_checks"][-20:]
    path.write_text(json.dumps(entry, indent=2), encoding="utf-8")