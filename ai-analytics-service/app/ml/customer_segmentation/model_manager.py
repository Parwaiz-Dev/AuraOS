"""
Lazy model manager for Customer Segmentation (KMeans + RFM scaler).

Stores:
- KMeans model (joblib)
- StandardScaler (joblib)
- RFM quantile thresholds (JSON)

Model path:  {MODELS_DIR}/customer_segmentation/{restaurant_id}/
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from threading import Lock
from typing import Any

import joblib
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app.config.settings import settings

logger = logging.getLogger(__name__)

_model_cache: dict[str, dict[str, Any]] = {}
_cache_lock = Lock()
_MODEL_NOT_FOUND = object()

SEGMENT_LABELS = {
    0: "VIP",
    1: "Loyal",
    2: "Regular",
    3: "At Risk",
    4: "Lost",
}


def _model_dir(restaurant_id: str) -> Path:
    base = Path(settings.MODELS_DIR).resolve()
    return base / "customer_segmentation" / restaurant_id


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def get_model(restaurant_id: str) -> dict[str, Any] | None:
    """Return {kmeans, scaler, thresholds} or None."""
    with _cache_lock:
        cached = _model_cache.get(restaurant_id)
    if cached is not None:
        if cached is _MODEL_NOT_FOUND:  # type: ignore[comparison-overlap]
            return None
        return cached  # type: ignore[return-value]

    model_dir = _model_dir(restaurant_id)
    kmeans_path = model_dir / "kmeans.joblib"
    scaler_path = model_dir / "scaler.joblib"
    thresholds_path = model_dir / "thresholds.json"

    if not kmeans_path.exists() or not scaler_path.exists():
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None

    try:
        kmeans: KMeans = joblib.load(kmeans_path)
        scaler: StandardScaler = joblib.load(scaler_path)
        thresholds: dict = {}
        if thresholds_path.exists():
            with open(thresholds_path, encoding="utf-8") as fh:
                thresholds = json.load(fh)

        bundled = {"kmeans": kmeans, "scaler": scaler, "thresholds": thresholds}
        with _cache_lock:
            _model_cache[restaurant_id] = bundled  # type: ignore[assignment]
        logger.info("Loaded Customer Segmentation model from %s", model_dir)
        return bundled
    except Exception:
        logger.exception("Failed to load Customer Segmentation model from %s", model_dir)
        with _cache_lock:
            _model_cache[restaurant_id] = _MODEL_NOT_FOUND  # type: ignore[assignment]
        return None


def save_model(
    restaurant_id: str,
    kmeans: KMeans,
    scaler: StandardScaler,
    thresholds: dict | None = None,
) -> str:
    model_dir = _model_dir(restaurant_id)
    _ensure_dir(model_dir)
    joblib.dump(kmeans, model_dir / "kmeans.joblib")
    joblib.dump(scaler, model_dir / "scaler.joblib")
    if thresholds:
        with open(model_dir / "thresholds.json", "w", encoding="utf-8") as fh:
            json.dump(thresholds, fh, default=str)

    bundled = {"kmeans": kmeans, "scaler": scaler, "thresholds": thresholds or {}}
    with _cache_lock:
        _model_cache[restaurant_id] = bundled  # type: ignore[assignment]
    logger.info("Saved Customer Segmentation model to %s", model_dir)
    return str(model_dir)


def invalidate_cache(restaurant_id: str | None = None) -> None:
    with _cache_lock:
        if restaurant_id is None:
            _model_cache.clear()
        else:
            _model_cache.pop(restaurant_id, None)