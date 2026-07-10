"""
Lazy model manager for Order Forecast (Prophet).

Model path:  {MODELS_DIR}/order_forecast/prophet_{restaurant_id}.json
"""

from __future__ import annotations

import logging
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    from prophet import Prophet

logger = logging.getLogger(__name__)

_model_cache: dict[str, "Prophet"] = {}
_cache_lock = Lock()
_MODEL_NOT_FOUND = object()


def _model_path(restaurant_id: str) -> Path:
    base = Path(settings.MODELS_DIR).resolve()
    return base / "order_forecast" / f"prophet_{restaurant_id}.json"


def _ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def get_model(restaurant_id: str) -> "Prophet | None":
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
        logger.info("No Order Forecast model at %s", path)
        return None

    try:
        from prophet import Prophet  # type: ignore[import-untyped]  # noqa: F401
        from prophet.serialize import model_from_json  # type: ignore[import-untyped]

        with open(path, encoding="utf-8") as fh:
            model_json = fh.read()
        model = model_from_json(model_json)

        with _cache_lock:
            _model_cache[restaurant_id] = model  # type: ignore[assignment]
        logger.info("Loaded Order Forecast model from %s", path)
        return model  # type: ignore[return-value]
    except Exception:
        logger.exception("Failed to load Order Forecast model from %s", path)
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None


def save_model(restaurant_id: str, model: "Prophet") -> str:
    path = _model_path(restaurant_id)
    _ensure_dir(path)
    from prophet.serialize import model_to_json  # type: ignore[import-untyped]

    model_json = model_to_json(model)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(model_json)
    with _cache_lock:
        _model_cache[restaurant_id] = model  # type: ignore[assignment]
    logger.info("Saved Order Forecast model to %s", path)
    return str(path)


def invalidate_cache(restaurant_id: str | None = None) -> None:
    with _cache_lock:
        if restaurant_id is None:
            _model_cache.clear()
        else:
            _model_cache.pop(restaurant_id, None)