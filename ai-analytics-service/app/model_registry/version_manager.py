"""Model Version Manager — semantic versioning for trained models.

Every retrain creates a new version (v1, v2, v3, ...).
The latest ACTIVE version is served; older versions are archived.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config.settings import settings

logger = logging.getLogger(__name__)

_VERSIONS_DIR = Path(settings.MODEL_REGISTRY_DIR) / "versions"


def _ensure_versions_dir() -> None:
    _VERSIONS_DIR.mkdir(parents=True, exist_ok=True)


def _versions_path(model_name: str, restaurant_id: str) -> Path:
    _ensure_versions_dir()
    return _VERSIONS_DIR / f"{model_name}_{restaurant_id}_versions.json"


def _read_versions(model_name: str, restaurant_id: str) -> list[dict]:
    path = _versions_path(model_name, restaurant_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _write_versions(model_name: str, restaurant_id: str, versions: list[dict]) -> None:
    path = _versions_path(model_name, restaurant_id)
    path.write_text(json.dumps(versions, indent=2), encoding="utf-8")


def get_current_version(model_name: str, restaurant_id: str) -> str | None:
    """Return the latest ACTIVE version string, or None."""
    versions = _read_versions(model_name, restaurant_id)
    active = [v for v in versions if v.get("status") == "ACTIVE"]
    if not active:
        return None
    # Sort by version number descending
    active.sort(key=lambda v: v.get("version_number", 0), reverse=True)
    return active[0]["version"]


def increment_version(model_name: str, restaurant_id: str) -> str:
    """Increment and return the next version string (e.g., 'v3')."""
    versions = _read_versions(model_name, restaurant_id)
    if versions:
        max_num = max(v.get("version_number", 0) for v in versions)
    else:
        max_num = 0
    next_num = max_num + 1
    new_version = f"v{next_num}"
    versions.append({
        "version": new_version,
        "version_number": next_num,
        "status": "ACTIVE",
    })
    _write_versions(model_name, restaurant_id, versions)
    logger.info("Version %s created for %s (restaurant=%s)", new_version, model_name, restaurant_id)
    return new_version


def archive_old_versions(model_name: str, restaurant_id: str) -> list[str]:
    """Archive versions beyond the retention limit. Returns list of archived versions."""
    versions = _read_versions(model_name, restaurant_id)
    if not versions:
        return []

    # Sort by version_number descending
    versions.sort(key=lambda v: v.get("version_number", 0), reverse=True)

    retention = settings.MODEL_RETENTION_VERSIONS
    archived = []
    for i, v in enumerate(versions):
        if i >= retention and v.get("status") == "ACTIVE":
            v["status"] = "ARCHIVED"
            archived.append(v["version"])
            logger.info("Archived %s version %s (restaurant=%s)", model_name, v["version"], restaurant_id)

    _write_versions(model_name, restaurant_id, versions)
    return archived


def list_versions(model_name: str, restaurant_id: str) -> list[dict]:
    """Return all version entries for a model × restaurant."""
    return _read_versions(model_name, restaurant_id)


def clear_versions(model_name: str, restaurant_id: str) -> None:
    """Remove all version tracking (for testing)."""
    path = _versions_path(model_name, restaurant_id)
    if path.exists():
        path.unlink()