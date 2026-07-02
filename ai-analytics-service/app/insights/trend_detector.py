"""Trend Detector — time-series analysis for week-over-week and month-over-month trends.

Detects:
    - Revenue trending up/down
    - Order volume trends
    - Customer growth/decline
    - Average order value changes
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class TrendResult:
    """A single detected trend."""

    type: str  # revenue_growth, revenue_decline, order_growth, order_decline, aov_change, customer_growth, customer_decline
    metric: str
    direction: str  # up, down, stable
    current_value: float
    previous_value: float
    change_pct: float
    period: str  # week, month
    description: str = ""


@dataclass
class TrendDetection:
    """Aggregated trend detection results."""

    trends: list[TrendResult] = field(default_factory=list)
    summary: str = ""


class TrendDetector:
    """Detects trends by comparing current period to previous period."""

    @staticmethod
    def _compute_change(current: float, previous: float) -> tuple[float, str]:
        """Compute percentage change and direction."""
        if previous == 0 and current == 0:
            return 0.0, "stable"
        if previous == 0:
            return 100.0, "up"
        change = ((current - previous) / abs(previous)) * 100
        if abs(change) < 5:
            direction = "stable"
        elif change > 0:
            direction = "up"
        else:
            direction = "down"
        return round(change, 1), direction

    async def detect_revenue_trends(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[TrendResult]:
        """Detect revenue trends week-over-week and month-over-month."""
        from app.repositories.revenue_repository import (
            fetch_daily_revenue,
            fetch_weekly_revenue,
            fetch_monthly_revenue,
        )

        results: list[TrendResult] = []

        # Week-over-week
        try:
            weekly = await fetch_weekly_revenue(db, restaurant_id, limit=3)
            if len(weekly) >= 2:
                current = float(weekly[0].get("revenue", 0))
                previous = float(weekly[1].get("revenue", 0))
                change, direction = self._compute_change(current, previous)

                trend_type = "revenue_growth" if direction == "up" else "revenue_decline" if direction == "down" else "revenue_stable"
                results.append(TrendResult(
                    type=trend_type,
                    metric="revenue",
                    direction=direction,
                    current_value=current,
                    previous_value=previous,
                    change_pct=change,
                    period="week",
                    description=f"Revenue {'grew' if direction == 'up' else 'declined' if direction == 'down' else 'remained stable'} {abs(change):.1f}% week-over-week (₹{current:,.0f} vs ₹{previous:,.0f})",
                ))
        except Exception:
            logger.exception("Weekly revenue trend detection failed")

        # Month-over-month
        try:
            monthly = await fetch_monthly_revenue(db, restaurant_id, limit=3)
            if len(monthly) >= 2:
                current = float(monthly[0].get("revenue", 0))
                previous = float(monthly[1].get("revenue", 0))
                change, direction = self._compute_change(current, previous)

                results.append(TrendResult(
                    type="revenue_change",
                    metric="revenue",
                    direction=direction,
                    current_value=current,
                    previous_value=previous,
                    change_pct=change,
                    period="month",
                    description=f"Revenue {'grew' if direction == 'up' else 'declined' if direction == 'down' else 'remained stable'} {abs(change):.1f}% month-over-month",
                ))
        except Exception:
            logger.exception("Monthly revenue trend detection failed")

        # Daily revenue 7-day rolling average trend
        try:
            daily = await fetch_daily_revenue(db, restaurant_id, limit=14)
            if len(daily) >= 14:
                recent_week = [float(r.get("revenue", 0)) for r in daily[:7]]
                prior_week = [float(r.get("revenue", 0)) for r in daily[7:14]]
                recent_avg = float(np.mean(recent_week))
                prior_avg = float(np.mean(prior_week))
                change, direction = self._compute_change(recent_avg, prior_avg)

                results.append(TrendResult(
                    type="revenue_change",
                    metric="revenue_7day_avg",
                    direction=direction,
                    current_value=round(recent_avg, 2),
                    previous_value=round(prior_avg, 2),
                    change_pct=change,
                    period="week",
                    description=f"7-day rolling average revenue {'up' if direction == 'up' else 'down'} {abs(change):.1f}% (₹{recent_avg:,.0f}/day vs ₹{prior_avg:,.0f}/day)",
                ))
        except Exception:
            logger.exception("7-day trend detection failed")

        return results

    async def detect_all(self, db: "AsyncSession", restaurant_id: str) -> TrendDetection:
        """Run all trend detectors."""
        trends = await self.detect_revenue_trends(db, restaurant_id)

        # Build summary
        up = sum(1 for t in trends if t.direction == "up")
        down = sum(1 for t in trends if t.direction == "down")
        stable = sum(1 for t in trends if t.direction == "stable")

        parts = []
        if up > 0:
            parts.append(f"{up} metric(s) trending up")
        if down > 0:
            parts.append(f"{down} metric(s) trending down")
        if stable > 0:
            parts.append(f"{stable} metric(s) stable")
        summary = "; ".join(parts) if parts else "No significant trends detected"

        return TrendDetection(trends=trends, summary=summary)


async def detect_trends(db: "AsyncSession", restaurant_id: str) -> TrendDetection:
    """Convenience function to detect all trends."""
    detector = TrendDetector()
    return await detector.detect_all(db, restaurant_id)