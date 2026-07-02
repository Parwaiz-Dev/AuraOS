"""
Lazy model manager for Recommendation Engine (association rules).

Stores:
- Co-occurrence matrix (JSON) — maps item_id -> list of {item_id, support, confidence}

Model path:  {MODELS_DIR}/recommendation_engine/{restaurant_id}_rules.json
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
    return base / "recommendation_engine" / f"{restaurant_id}_rules.json"


def _ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def get_model(restaurant_id: str) -> dict[str, Any] | None:
    """
    Return the association rules dict for *restaurant_id* or None.

    The dict shape:
      { "item_id_1": [{"itemId": "2", "itemName": "Coke", "confidence": 0.75, "support": 0.20}, ...] }
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
            rules = json.load(fh)
        with _cache_lock:
            _model_cache[restaurant_id] = rules
        logger.info("Loaded Recommendation rules from %s", path)
        return rules
    except Exception:
        logger.exception("Failed to load Recommendation rules from %s", path)
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None


def save_model(restaurant_id: str, rules: dict[str, Any]) -> str:
    path = _model_path(restaurant_id)
    _ensure_dir(path)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(rules, fh, default=str)
    with _cache_lock:
        _model_cache[restaurant_id] = rules
    logger.info("Saved Recommendation rules to %s", path)
    return str(path)


def invalidate_cache(restaurant_id: str | None = None) -> None:
    with _cache_lock:
        if restaurant_id is None:
            _model_cache.clear()
        else:
            _model_cache.pop(restaurant_id, None)