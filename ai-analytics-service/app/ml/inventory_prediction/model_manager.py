"""
Lazy model manager for Inventory Prediction (linear regression / moving averages).

Model path:  {MODELS_DIR}/inventory_prediction/{restaurant_id}/
Stores:
- consumption_rate.json — per-ingredient daily consumption rates
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from threading import Lock
from typing import Any

from app.config.settings import settings

logger = logging.getLogger(__name__)

_model_cache: dict[str, dict[str, Any]] = {}
_cache_lock = Lock()
_MODEL_NOT_FOUND = object()


def _model_path(restaurant_id: str) -> Path:
    base = Path(settings.MODELS_DIR).resolve()
    return base / "inventory_prediction" / f"{restaurant_id}_consumption.json"


def _ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def get_model(restaurant_id: str) -> dict[str, Any] | None:
    """
    Return per-ingredient consumption rates.

    Shape: { "item_id_1": {"dailyRate": 2.5, "name": "Flour", "unit": "kg"}, ... }
    """
    with _cache_lock:
        cached = _model_cache.get(restaurant_id)
    if cached is not None:
        if cached is _MODEL_NOT_FOUND:  # type: ignore[comparison-overlap]
            return None
        return cached  # type: ignore[return-value]

    path = _model_path(restaurant_id)
    if not path.exists():
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None

    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        with _cache_lock:
            _model_cache[restaurant_id] = data
        logger.info("Loaded Inventory Prediction model from %s", path)
        return data
    except Exception:
        logger.exception("Failed to load Inventory Prediction model from %s", path)
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None


def save_model(restaurant_id: str, data: dict[str, Any]) -> str:
    path = _model_path(restaurant_id)
    _ensure_dir(path)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, default=str)
    with _cache_lock:
        _model_cache[restaurant_id] = data
    logger.info("Saved Inventory Prediction model to %s", path)
    return str(path)


def invalidate_cache(restaurant_id: str | None = None) -> None:
    with _cache_lock:
        if restaurant_id is None:
            _model_cache.clear()
        else:
            _model_cache.pop(restaurant_id, None)