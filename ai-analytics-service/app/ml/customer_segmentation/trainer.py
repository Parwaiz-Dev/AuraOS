"""Trainer for Customer Segmentation — KMeans clustering on RFM features."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app.ml.customer_segmentation.model_manager import save_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
_MIN_CUSTOMERS = 20


async def train_customer_segmentation(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    lookback_days: int = 365,
) -> dict | None:
    """
    Extract RFM (Recency, Frequency, Monetary) features, cluster customers
    with KMeans (k=5), and persist the model.
    """
    from app.repositories.customer_repository import fetch_customer_rfm

    rows = await fetch_customer_rfm(
        db, restaurant_id,
        reference_date=date.today(),
        lookback_days=lookback_days,
    )

    if len(rows) < _MIN_CUSTOMERS:
        logger.warning("Insufficient customers for segmentation (n=%d)", len(rows))
        return None

    df = pd.DataFrame(rows)
    # columns: customer_id, recency_days, frequency, monetary
    rfm = df[["recency_days", "frequency", "monetary"]].copy()

    # Handle zeros / missing
    rfm = rfm.fillna(0)

    # Scale
    scaler = StandardScaler()
    rfm_scaled = scaler.fit_transform(rfm)

    # KMeans with 5 clusters
    kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(rfm_scaled)

    # Compute per-cluster centroids for sorting (best cluster = low recency, high freq, high monetary)
    centroids = kmeans.cluster_centers_
    # Score: -recency + frequency + monetary (higher = better)
    scores = -centroids[:, 0] + centroids[:, 1] + centroids[:, 2]
    cluster_rank = np.argsort(np.argsort(-scores))  # 0 = best cluster

    # Map cluster labels: 0=VIP, 1=Loyal, 2=Regular, 3=At Risk, 4=Lost
    label_map = {old: new for old, new in enumerate(cluster_rank)}
    # remap clusters
    # label_map maps original cluster index -> ranked index

    # Build thresholds for future classification
    thresholds = {
        "recency_quantiles": rfm["recency_days"].quantile([0.2, 0.4, 0.6, 0.8]).tolist(),
        "frequency_quantiles": rfm["frequency"].quantile([0.2, 0.4, 0.6, 0.8]).tolist(),
        "monetary_quantiles": rfm["monetary"].quantile([0.2, 0.4, 0.6, 0.8]).tolist(),
    }

    save_model(restaurant_id, kmeans, scaler, thresholds)
    logger.info(
        "Customer segmentation model trained (restaurant=%s, customers=%d)",
        restaurant_id, len(df),
    )
    return {"label_map": {str(k): v for k, v in label_map.items()}, "thresholds": thresholds}