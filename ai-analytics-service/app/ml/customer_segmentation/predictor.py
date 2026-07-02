"""Predictor for Customer Segmentation — classify customers into segments."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np
from sklearn.preprocessing import StandardScaler

from app.ml.customer_segmentation.model_manager import SEGMENT_LABELS, get_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def predict_segments(
    restaurant_id: str,
    *,
    db: "AsyncSession | None" = None,
) -> list[dict] | None:
    """
    Return customer segments for all customers of *restaurant_id*.

    Each item: {customerId, name, segment, recencyDays, frequency, monetary, totalSpent}
    """
    bundled = get_model(restaurant_id)
    if bundled is None:
        logger.info("No cached segmentation model for %s; attempting auto-train", restaurant_id)
        if db is not None:
            from app.ml.customer_segmentation.trainer import train_customer_segmentation

            await train_customer_segmentation(db, restaurant_id)
            bundled = get_model(restaurant_id)
        if bundled is None:
            return None

    kmeans = bundled["kmeans"]
    scaler: StandardScaler = bundled["scaler"]

    from datetime import date

    from app.repositories.customer_repository import fetch_customer_rfm

    if db is None:
        return None

    rows = await fetch_customer_rfm(
        db, restaurant_id,
        reference_date=date.today(),
        lookback_days=365,
    )

    if not rows:
        return []

    import pandas as pd

    df = pd.DataFrame(rows)
    rfm = df[["recency_days", "frequency", "monetary"]].fillna(0)
    rfm_scaled = scaler.transform(rfm)
    clusters = kmeans.predict(rfm_scaled)

    # Re-rank clusters as in trainer (best cluster = lowest recency, highest freq, highest monetary)
    centroids = kmeans.cluster_centers_
    scores = -centroids[:, 0] + centroids[:, 1] + centroids[:, 2]
    cluster_rank = np.argsort(np.argsort(-scores))

    results = []
    for i, row in df.iterrows():
        orig_cluster = int(clusters[i])
        ranked = int(cluster_rank[orig_cluster])
        segment = SEGMENT_LABELS.get(ranked, "Regular")
        results.append({
            "customerId": str(row["customer_id"]),
            "name": row.get("name", "Unknown"),
            "segment": segment,
            "recencyDays": int(row["recency_days"]),
            "frequency": int(row["frequency"]),
            "monetary": round(float(row["monetary"]), 2),
            "totalSpent": round(float(row["monetary"]), 2),
        })

    return results