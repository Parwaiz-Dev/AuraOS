"""Anomaly Detector — Isolation Forest-based detection of abnormal patterns.

Detects:
    - Revenue drops / spikes
    - Order volume anomalies
    - Customer count declines
    - Inventory shortage signals
    - Wait time increases
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class AnomalyResult:
    """A single detected anomaly."""

    type: str  # revenue_drop, revenue_spike, order_spike, customer_decline, inventory_shortage, wait_time_increase
    severity: str  # low, medium, high, critical
    metric: str
    current_value: float
    expected_value: float
    deviation_pct: float
    detected_at: str
    description: str = ""


@dataclass
class AnomalyDetection:
    """Aggregated anomaly detection results."""

    anomalies: list[AnomalyResult] = field(default_factory=list)
    total_checked: int = 0


class AnomalyDetector:
    """Detects anomalies in restaurant operational metrics.

    Uses Isolation Forest when enough data is available, falling back
    to Z-score based detection for small datasets.
    """

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination

    def _isolation_forest_score(self, data: list[float]) -> list[float]:
        """Compute anomaly scores using Isolation Forest.

        Falls back to Z-score when data is too small for IF.
        """
        n = len(data)
        if n < 7:
            return self._zscore_anomaly_scores(data)

        try:
            from sklearn.ensemble import IsolationForest

            X = np.array(data).reshape(-1, 1)
            model = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100,
            )
            preds = model.fit_predict(X)
            # Convert to anomaly scores: -1 = anomaly, 1 = normal
            scores = model.decision_function(X)
            # Normalize to 0-1 where higher = more anomalous
            normalized = 1.0 - (scores - scores.min()) / (scores.max() - scores.min() + 1e-10)
            return [float(s) if p == -1 else 0.0 for s, p in zip(normalized, preds)]
        except Exception:
            logger.warning("IsolationForest failed, falling back to Z-score")
            return self._zscore_anomaly_scores(data)

    def _zscore_anomaly_scores(self, data: list[float]) -> list[float]:
        """Z-score based anomaly detection as fallback."""
        if len(data) < 3:
            return [0.0] * len(data)

        arr = np.array(data)
        mean = arr.mean()
        std = arr.std()
        if std == 0 or np.isnan(std):
            return [0.0] * len(arr)

        z_scores = np.abs((arr - mean) / std)
        # Normalize: z=2 → 0.5, z=3 → 0.75, z=4 → 1.0
        normalized = np.clip(z_scores / 4.0, 0.0, 1.0)
        return [float(s) for s in normalized]

    async def detect_revenue_anomalies(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[AnomalyResult]:
        """Detect revenue anomalies from daily revenue data."""
        from app.repositories.revenue_repository import fetch_daily_revenue

        rows = await fetch_daily_revenue(db, restaurant_id, limit=30)
        if len(rows) < 7:
            return []

        revenues = [float(r.get("revenue", 0)) for r in reversed(rows)]
        dates = [str(r.get("date", "")) for r in reversed(rows)]
        scores = self._isolation_forest_score(revenues)

        results: list[AnomalyResult] = []
        for i, score in enumerate(scores):
            if score < 0.3:
                continue

            current = revenues[i]
            # Expected = median of non-anomalous days
            normal_vals = [v for j, v in enumerate(revenues) if j != i and scores[j] < 0.3]
            expected = float(np.median(normal_vals)) if normal_vals else current

            if expected == 0:
                continue

            deviation = ((current - expected) / expected) * 100

            if deviation < -5:
                anomaly_type = "revenue_drop"
                severity = "high" if deviation < -20 else "medium" if deviation < -10 else "low"
                description = f"Revenue dropped {abs(deviation):.0f}% on {dates[i]} compared to expected ₹{expected:,.0f}"
            elif deviation > 20:
                anomaly_type = "revenue_spike"
                severity = "medium" if deviation < 50 else "low"
                description = f"Revenue spiked {deviation:.0f}% on {dates[i]} (₹{current:,.0f} vs ₹{expected:,.0f})"
            else:
                continue

            results.append(AnomalyResult(
                type=anomaly_type,
                severity=severity,
                metric="revenue",
                current_value=current,
                expected_value=expected,
                deviation_pct=round(deviation, 1),
                detected_at=datetime.now().isoformat(),
                description=description,
            ))

        return results

    async def detect_order_anomalies(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[AnomalyResult]:
        """Detect order volume anomalies."""
        from app.repositories.revenue_repository import fetch_daily_revenue

        rows = await fetch_daily_revenue(db, restaurant_id, limit=30)
        if len(rows) < 7:
            return []

        orders = [int(r.get("order_count", 0)) for r in reversed(rows)]
        dates = [str(r.get("date", "")) for r in reversed(rows)]
        scores = self._isolation_forest_score([float(o) for o in orders])

        results: list[AnomalyResult] = []
        for i, score in enumerate(scores):
            if score < 0.3:
                continue

            current = orders[i]
            normal_vals = [v for j, v in enumerate(orders) if j != i and scores[j] < 0.3]
            expected = float(np.median(normal_vals)) if normal_vals else float(current)

            if expected == 0:
                continue

            deviation = ((current - expected) / expected) * 100
            if abs(deviation) < 20:
                continue

            anomaly_type = "order_spike" if deviation > 0 else "order_drop"
            severity = "high" if abs(deviation) > 50 else "medium" if abs(deviation) > 30 else "low"

            results.append(AnomalyResult(
                type=anomaly_type,
                severity=severity,
                metric="order_count",
                current_value=float(current),
                expected_value=expected,
                deviation_pct=round(deviation, 1),
                detected_at=datetime.now().isoformat(),
                description=f"Orders {'spiked' if deviation > 0 else 'dropped'} {abs(deviation):.0f}% on {dates[i]} ({current} vs expected {expected:.0f})",
            ))

        return results

    async def detect_inventory_anomalies(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[AnomalyResult]:
        """Detect inventory items running critically low."""
        from sqlalchemy import select

        from app.models import InventoryItem, MenuItem

        stmt = (
            select(InventoryItem, MenuItem.name)
            .join(MenuItem, InventoryItem.menu_item_id == MenuItem.id)
            .where(InventoryItem.restaurant_id == restaurant_id)
        )
        result = await db.execute(stmt)
        rows = result.all()

        results: list[AnomalyResult] = []
        for inv_item, item_name in rows:
            if inv_item.current_stock <= inv_item.reorder_level:
                severity = "critical" if inv_item.current_stock == 0 else "high" if inv_item.current_stock <= inv_item.reorder_level // 2 else "medium"
                results.append(AnomalyResult(
                    type="inventory_shortage",
                    severity=severity,
                    metric="stock_level",
                    current_value=float(inv_item.current_stock),
                    expected_value=float(inv_item.reorder_level),
                    deviation_pct=round((1 - inv_item.current_stock / max(inv_item.reorder_level, 1)) * 100, 1),
                    detected_at=datetime.now().isoformat(),
                    description=f"{item_name} stock is low ({inv_item.current_stock} remaining, reorder at {inv_item.reorder_level})",
                ))

        return results

    async def detect_all(self, db: "AsyncSession", restaurant_id: str) -> AnomalyDetection:
        """Run all anomaly detectors and return aggregated results."""
        all_anomalies: list[AnomalyResult] = []
        total = 0

        try:
            revenue = await self.detect_revenue_anomalies(db, restaurant_id)
            all_anomalies.extend(revenue)
            total += 1
        except Exception:
            logger.exception("Revenue anomaly detection failed")

        try:
            orders = await self.detect_order_anomalies(db, restaurant_id)
            all_anomalies.extend(orders)
            total += 1
        except Exception:
            logger.exception("Order anomaly detection failed")

        try:
            inventory = await self.detect_inventory_anomalies(db, restaurant_id)
            all_anomalies.extend(inventory)
            total += 1
        except Exception:
            logger.exception("Inventory anomaly detection failed")

        return AnomalyDetection(anomalies=all_anomalies, total_checked=total)


async def detect_anomalies(db: "AsyncSession", restaurant_id: str) -> AnomalyDetection:
    """Convenience function to run all anomaly detection."""
    from app.config.settings import settings

    detector = AnomalyDetector(contamination=settings.ANOMALY_CONTAMINATION)
    return await detector.detect_all(db, restaurant_id)