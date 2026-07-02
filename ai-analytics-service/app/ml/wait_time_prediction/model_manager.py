"""
Lazy model manager for Wait Time Prediction (XGBoost Regressor).

Model path:  {MODELS_DIR}/wait_time_prediction/{restaurant_id}_xgb.joblib
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from threading import Lock
from typing import Any

import joblib
from xgboost import XGBRegressor

from app.config.settings import settings

logger = logging.getLogger(__name__)

_model_cache: dict[str, dict[str, Any]] = {}
_cache_lock = Lock()
_MODEL_NOT_FOUND = object()


def _model_dir(restaurant_id: str) -> Path:
    base = Path(settings.MODELS_DIR).resolve()
    return base / "wait_time_prediction" / restaurant_id


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def get_model(restaurant_id: str) -> dict[str, Any] | None:
    """Return {model, feature_names} or None."""
    with _cache_lock:
        cached = _model_cache.get(restaurant_id)
    if cached is not None:
        if cached is _MODEL_NOT_FOUND:  # type: ignore[comparison-overlap]
            return None
        return cached  # type: ignore[return-value]

    model_dir = _model_dir(restaurant_id)
    model_path = model_dir / "xgb_model.joblib"
    meta_path = model_dir / "metadata.json"

    if not model_path.exists():
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None

    try:
        model: XGBRegressor = joblib.load(model_path)
        meta: dict = {}
        if meta_path.exists():
            with open(meta_path, encoding="utf-8") as fh:
                meta = json.load(fh)

        bundled = {"model": model, "feature_names": meta.get("feature_names", [])}
        with _cache_lock:
            _model_cache[restaurant_id] = bundled  # type: ignore[assignment]
        logger.info("Loaded Wait Time model from %s", model_dir)
        return bundled
    except Exception:
        logger.exception("Failed to load Wait Time model from %s", model_dir)
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None


def save_model(
    restaurant_id: str,
    model: XGBRegressor,
    feature_names: list[str],
) -> str:
    model_dir = _model_dir(restaurant_id)
    _ensure_dir(model_dir)
    joblib.dump(model, model_dir / "xgb_model.joblib")
    meta = {"feature_names": feature_names}
    with open(model_dir / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh)

    bundled = {"model": model, "feature_names": feature_names}
    with _cache_lock:
        _model_cache[restaurant_id] = bundled  # type: ignore[assignment]
    logger.info("Saved Wait Time model to %s", model_dir)
    return str(model_dir)


def invalidate_cache(restaurant_id: str | None = None) -> None:
    with _cache_lock:
        if restaurant_id is None:
            _model_cache.clear()
        else:
            _model_cache.pop(restaurant_id, None)