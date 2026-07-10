"""
Lazy model manager for Revenue Forecast (Prophet).

Responsibilities:
- Load a pre-trained Prophet model from disk on first access.
- Cache the model in memory so subsequent calls are instant.
- Provide a `save_model` helper for training pipelines.
- Never train on every request — training is explicit / scheduled.

Model path:  {MODELS_DIR}/revenue_forecast/prophet_model.json
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    from prophet import Prophet

logger = logging.getLogger(__name__)

# Module-level cache — one model per restaurant (keyed by restaurant_id).
# In production you might want an LRU cache; for now a simple dict is fine.
_model_cache: dict[str, "Prophet"] = {}
_cache_lock = Lock()

# Sentinel for "no model found"
_MODEL_NOT_FOUND = object()


def _model_path(restaurant_id: str) -> Path:
    """Absolute path to the serialised Prophet model for a restaurant."""
    base = Path(settings.MODELS_DIR).resolve()
    return base / "revenue_forecast" / f"prophet_{restaurant_id}.json"


def _ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def get_model(restaurant_id: str) -> "Prophet | None":
    """
    Return the cached Prophet model for *restaurant_id*, loading it from disk
    if necessary.  Returns ``None`` when no serialised model exists yet.
    """
    # Fast path — already cached
    with _cache_lock:
        cached = _model_cache.get(restaurant_id)

    if cached is not None:
        if cached is _MODEL_NOT_FOUND:  # type: ignore[comparison-overlap]
            return None
        return cached  # type: ignore[return-value]

    # Slow path — load from disk
    path = _model_path(restaurant_id)
    if not path.exists():
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        logger.info("No Prophet model found at %s", path)
        return None

    try:
        from prophet import Prophet  # type: ignore[import-untyped]  # noqa: F401
        from prophet.serialize import model_from_json  # type: ignore[import-untyped]

        # Prophet's official serialization: the file holds the JSON *string*
        # produced by model_to_json (see save_model below).
        with open(path, encoding="utf-8") as fh:
            model_json = fh.read()
        model = model_from_json(model_json)

        with _cache_lock:
            _model_cache[restaurant_id] = model  # type: ignore[assignment]

        logger.info("Loaded Prophet model from %s", path)
        return model  # type: ignore[return-value]
    except Exception:
        logger.exception("Failed to load Prophet model from %s", path)
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None


def save_model(restaurant_id: str, model: "Prophet") -> str:
    """
    Serialise *model* to disk and update the in-memory cache.

    Returns the absolute path the model was written to.
    """
    path = _model_path(restaurant_id)
    _ensure_dir(path)

    from prophet.serialize import model_to_json  # type: ignore[import-untyped]

    # Prophet's official serialization produces a JSON *string*; write it verbatim.
    model_json = model_to_json(model)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(model_json)

    with _cache_lock:
        _model_cache[restaurant_id] = model  # type: ignore[assignment]

    logger.info("Saved Prophet model to %s", path)
    return str(path)


def invalidate_cache(restaurant_id: str | None = None) -> None:
    """Clear the in-memory model cache (useful after retraining)."""
    with _cache_lock:
        if restaurant_id is None:
            _model_cache.clear()
        else:
            _model_cache.pop(restaurant_id, None)