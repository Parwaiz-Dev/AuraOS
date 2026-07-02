"""Insight Generator — orchestrates all detectors into daily & weekly insights.

Combines anomaly detection, trend analysis, opportunity detection, and risk
detection into structured daily insights and weekly reports. Maintains an
in-memory history of generated insights for the /history endpoint.
"""

from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.insights.anomaly_detector import AnomalyDetector, AnomalyDetection
from app.insights.opportunity_detector import (
    OpportunityDetection,
    OpportunityDetector,
)
from app.insights.risk_detector import RiskDetection, RiskDetector
from app.insights.trend_detector import TrendDetection, TrendDetector

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── In-memory history (Redis-backed write-through; deque is the fallback) ────────
_insight_history: deque[dict] = deque(maxlen=settings.INSIGHTS_HISTORY_MAX)

# Redis key for the shared insight history list (newest first).
_HISTORY_KEY = "insights:history"


async def _persist_history_entry(entry: dict) -> None:
    """Write an insight entry through to Redis (best-effort) and the in-memory deque."""
    _insight_history.appendleft(entry)
    try:
        import json

        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            await r.lpush(_HISTORY_KEY, json.dumps(entry, default=str))
            await r.ltrim(_HISTORY_KEY, 0, settings.INSIGHTS_HISTORY_MAX - 1)
    except Exception:
        logger.debug("Failed to persist insight history to Redis", exc_info=True)


@dataclass
class DailyInsight:
    """Complete daily insight report."""

    restaurant_id: str
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    anomalies: AnomalyDetection = field(default_factory=AnomalyDetection)
    trends: TrendDetection = field(default_factory=TrendDetection)
    opportunities: OpportunityDetection = field(default_factory=OpportunityDetection)
    risks: RiskDetection = field(default_factory=RiskDetection)
    summary: str = ""
    anomaly_count: int = 0
    trend_count: int = 0
    opportunity_count: int = 0
    risk_count: int = 0

    def to_dict(self) -> dict:
        """Serialize to a dict for API responses and history storage."""
        return {
            "restaurant_id": self.restaurant_id,
            "generated_at": self.generated_at,
            "summary": self.summary,
            "anomalies": _serialize_anomalies(self.anomalies),
            "trends": _serialize_trends(self.trends),
            "opportunities": _serialize_opportunities(self.opportunities),
            "risks": _serialize_risks(self.risks),
            "counts": {
                "anomalies": self.anomaly_count,
                "trends": self.trend_count,
                "opportunities": self.opportunity_count,
                "risks": self.risk_count,
            },
        }


@dataclass
class WeeklyReport:
    """Complete weekly AI report."""

    restaurant_id: str
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    daily_insights: list[DailyInsight] = field(default_factory=list)
    aggregated_anomalies: AnomalyDetection = field(default_factory=AnomalyDetection)
    aggregated_trends: TrendDetection = field(default_factory=TrendDetection)
    aggregated_opportunities: OpportunityDetection = field(default_factory=OpportunityDetection)
    aggregated_risks: RiskDetection = field(default_factory=RiskDetection)
    summary: str = ""
    week_start: str = ""
    week_end: str = ""

    def to_dict(self) -> dict:
        """Serialize to a dict for API responses."""
        return {
            "restaurant_id": self.restaurant_id,
            "generated_at": self.generated_at,
            "week_start": self.week_start,
            "week_end": self.week_end,
            "summary": self.summary,
            "anomalies": _serialize_anomalies(self.aggregated_anomalies),
            "trends": _serialize_trends(self.aggregated_trends),
            "opportunities": _serialize_opportunities(self.aggregated_opportunities),
            "risks": _serialize_risks(self.aggregated_risks),
            "counts": {
                "anomalies": len(self.aggregated_anomalies.anomalies),
                "trends": len(self.aggregated_trends.trends),
                "opportunities": len(self.aggregated_opportunities.opportunities),
                "risks": len(self.aggregated_risks.risks),
            },
        }


class InsightGenerator:
    """Orchestrates all detectors and generates structured insight reports."""

    def __init__(self) -> None:
        self._anomaly_detector = AnomalyDetector(
            contamination=settings.ANOMALY_CONTAMINATION,
        )

    async def generate_daily_insights(
        self,
        db: "AsyncSession",
        restaurant_id: str,
        restaurant_name: str = "Your restaurant",
    ) -> DailyInsight:
        """Run all detectors and produce a daily insight report.

        Args:
            db: Async database session.
            restaurant_id: Target restaurant UUID.
            restaurant_name: Display name for summaries.

        Returns:
            A complete DailyInsight with all detection results.
        """
        logger.info("Generating daily insights for restaurant %s", restaurant_id)

        anomaly_detection: AnomalyDetection = AnomalyDetection()
        trend_detection: TrendDetection = TrendDetection()
        opportunity_detection: OpportunityDetection = OpportunityDetection()
        risk_detection: RiskDetection = RiskDetection()

        # Run all detectors in parallel where possible
        # (Each detector manages its own DB queries independently)

        if settings.ANOMALY_ENABLED:
            try:
                anomaly_detection = await self._anomaly_detector.detect_all(db, restaurant_id)
            except Exception:
                logger.exception("Anomaly detection failed for daily insights")

        try:
            trend_detector = TrendDetector()
            trend_detection = await trend_detector.detect_all(db, restaurant_id)
        except Exception:
            logger.exception("Trend detection failed for daily insights")

        try:
            opportunity_detector = OpportunityDetector()
            opportunity_detection = await opportunity_detector.detect_all(db, restaurant_id)
        except Exception:
            logger.exception("Opportunity detection failed for daily insights")

        try:
            risk_detector = RiskDetector()
            risk_detection = await risk_detector.detect_all(db, restaurant_id)
        except Exception:
            logger.exception("Risk detection failed for daily insights")

        # Build summary
        from app.insights.explanation_engine import generate_daily_summary

        anomaly_count = len(anomaly_detection.anomalies)
        trend_count = len(trend_detection.trends)
        opportunity_count = len(opportunity_detection.opportunities)
        risk_count = len(risk_detection.risks)

        summary = generate_daily_summary(
            anomaly_count=anomaly_count,
            trend_count=trend_count,
            opportunity_count=opportunity_count,
            risk_count=risk_count,
            restaurant_name=restaurant_name,
        )

        insight = DailyInsight(
            restaurant_id=restaurant_id,
            anomalies=anomaly_detection,
            trends=trend_detection,
            opportunities=opportunity_detection,
            risks=risk_detection,
            summary=summary,
            anomaly_count=anomaly_count,
            trend_count=trend_count,
            opportunity_count=opportunity_count,
            risk_count=risk_count,
        )

        # Store in history (Redis write-through + in-memory fallback)
        await _persist_history_entry(insight.to_dict())

        logger.info(
            "Daily insights generated: %d anomalies, %d trends, %d opportunities, %d risks",
            anomaly_count, trend_count, opportunity_count, risk_count,
        )

        return insight

    async def generate_weekly_report(
        self,
        db: "AsyncSession",
        restaurant_id: str,
        restaurant_name: str = "Your restaurant",
    ) -> WeeklyReport:
        """Generate a comprehensive weekly AI report.

        Runs all detectors and aggregates results into a weekly overview.

        Args:
            db: Async database session.
            restaurant_id: Target restaurant UUID.
            restaurant_name: Display name for summaries.

        Returns:
            A complete WeeklyReport.
        """
        from datetime import timedelta

        logger.info("Generating weekly report for restaurant %s", restaurant_id)

        # Run all detectors
        anomaly_detection = AnomalyDetection()
        trend_detection = TrendDetection()
        opportunity_detection = OpportunityDetection()
        risk_detection = RiskDetection()

        if settings.ANOMALY_ENABLED:
            try:
                anomaly_detection = await self._anomaly_detector.detect_all(db, restaurant_id)
            except Exception:
                logger.exception("Anomaly detection failed for weekly report")

        try:
            trend_detector = TrendDetector()
            trend_detection = await trend_detector.detect_all(db, restaurant_id)
        except Exception:
            logger.exception("Trend detection failed for weekly report")

        try:
            opportunity_detector = OpportunityDetector()
            opportunity_detection = await opportunity_detector.detect_all(db, restaurant_id)
        except Exception:
            logger.exception("Opportunity detection failed for weekly report")

        try:
            risk_detector = RiskDetector()
            risk_detection = await risk_detector.detect_all(db, restaurant_id)
        except Exception:
            logger.exception("Risk detection failed for weekly report")

        # Fetch weekly revenue for the summary
        from app.repositories.revenue_repository import fetch_weekly_revenue

        total_revenue = 0.0
        try:
            weekly = await fetch_weekly_revenue(db, restaurant_id, limit=1)
            if weekly:
                total_revenue = float(weekly[0].get("revenue", 0))
        except Exception:
            logger.exception("Failed to fetch weekly revenue for report")

        # Build weekly summary
        from app.insights.explanation_engine import generate_weekly_summary

        anomaly_count = len(anomaly_detection.anomalies)
        trend_count = len(trend_detection.trends)
        opportunity_count = len(opportunity_detection.opportunities)
        risk_count = len(risk_detection.risks)

        summary = generate_weekly_summary(
            anomaly_count=anomaly_count,
            trend_count=trend_count,
            opportunity_count=opportunity_count,
            risk_count=risk_count,
            total_revenue=total_revenue,
            restaurant_name=restaurant_name,
        )

        now = datetime.now()
        week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
        week_end = now.strftime("%Y-%m-%d")

        report = WeeklyReport(
            restaurant_id=restaurant_id,
            aggregated_anomalies=anomaly_detection,
            aggregated_trends=trend_detection,
            aggregated_opportunities=opportunity_detection,
            aggregated_risks=risk_detection,
            summary=summary,
            week_start=week_start,
            week_end=week_end,
        )

        # Store in history (Redis write-through + in-memory fallback)
        await _persist_history_entry(report.to_dict())

        logger.info(
            "Weekly report generated: %d anomalies, %d trends, %d opportunities, %d risks",
            anomaly_count, trend_count, opportunity_count, risk_count,
        )

        return report


# ── Module-level convenience functions ─────────────────────────────────────────


async def generate_daily_insights(
    db: "AsyncSession",
    restaurant_id: str,
    restaurant_name: str = "Your restaurant",
) -> DailyInsight:
    """Generate daily insights for a restaurant."""
    generator = InsightGenerator()
    return await generator.generate_daily_insights(db, restaurant_id, restaurant_name)


async def generate_weekly_report(
    db: "AsyncSession",
    restaurant_id: str,
    restaurant_name: str = "Your restaurant",
) -> WeeklyReport:
    """Generate a weekly report for a restaurant."""
    generator = InsightGenerator()
    return await generator.generate_weekly_report(db, restaurant_id, restaurant_name)


async def get_insight_history(
    restaurant_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Retrieve stored insight history, optionally filtered by restaurant.

    Reads from Redis when available (survives restarts / shared across workers),
    falling back to the in-memory deque otherwise.

    Args:
        restaurant_id: Optional filter by restaurant.
        limit: Maximum number of entries to return.

    Returns:
        List of insight dicts, newest first.
    """
    entries: list[dict] = list(_insight_history)

    try:
        import json

        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            raw = await r.lrange(_HISTORY_KEY, 0, settings.INSIGHTS_HISTORY_MAX - 1)
            if raw:
                entries = [json.loads(item) for item in raw]
    except Exception:
        logger.debug("Failed to read insight history from Redis", exc_info=True)

    results: list[dict] = []
    for entry in entries:
        if restaurant_id is None or entry.get("restaurant_id") == restaurant_id:
            results.append(entry)
            if len(results) >= limit:
                break
    return results


async def clear_insight_history() -> int:
    """Clear all stored insight history (in-memory + Redis). Returns entries cleared."""
    count = len(_insight_history)
    _insight_history.clear()
    try:
        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            await r.delete(_HISTORY_KEY)
    except Exception:
        logger.debug("Failed to clear insight history in Redis", exc_info=True)
    return count


# ── Serialization helpers ──────────────────────────────────────────────────────


def _serialize_anomalies(detection: AnomalyDetection) -> list[dict]:
    """Serialize anomaly detection results to JSON-safe dicts."""
    return [
        {
            "type": a.type,
            "severity": a.severity,
            "metric": a.metric,
            "current_value": a.current_value,
            "expected_value": a.expected_value,
            "deviation_pct": a.deviation_pct,
            "detected_at": a.detected_at,
            "description": a.description,
        }
        for a in detection.anomalies
    ]


def _serialize_trends(detection: TrendDetection) -> list[dict]:
    """Serialize trend detection results to JSON-safe dicts."""
    return [
        {
            "type": t.type,
            "metric": t.metric,
            "direction": t.direction,
            "current_value": t.current_value,
            "previous_value": t.previous_value,
            "change_pct": t.change_pct,
            "period": t.period,
            "description": t.description,
        }
        for t in detection.trends
    ]


def _serialize_opportunities(detection: OpportunityDetection) -> list[dict]:
    """Serialize opportunity detection results to JSON-safe dicts."""
    return [
        {
            "type": o.type,
            "severity": o.severity,
            "category": o.category,
            "detail": o.detail,
            "recommendation": o.recommendation,
            "potential_value": o.potential_value,
            "detected_at": o.detected_at,
        }
        for o in detection.opportunities
    ]


def _serialize_risks(detection: RiskDetection) -> list[dict]:
    """Serialize risk detection results to JSON-safe dicts."""
    return [
        {
            "type": r.type,
            "severity": r.severity,
            "category": r.category,
            "detail": r.detail,
            "recommendation": r.recommendation,
            "probability": r.probability,
            "detected_at": r.detected_at,
        }
        for r in detection.risks
    ]