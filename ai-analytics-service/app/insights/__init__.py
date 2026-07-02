"""Insights package — proactive intelligence detection and generation.

Modules:
    anomaly_detector  — Isolation Forest anomaly detection on revenue, orders, inventory
    trend_detector    — Time-series trend analysis (week-over-week, month-over-month)
    opportunity_detector — Upsell opportunities, peak periods, high-value customers
    risk_detector     — Customer churn, inventory stockout, revenue decline prediction
    insight_generator — Orchestrator that combines all detectors into daily insights
    explanation_engine — Generates human-readable explanations for insights
"""

from __future__ import annotations

from app.insights.anomaly_detector import AnomalyDetector, detect_anomalies
from app.insights.explanation_engine import explain_insight
from app.insights.insight_generator import (
    InsightGenerator,
    generate_daily_insights,
    generate_weekly_report,
)
from app.insights.opportunity_detector import (
    OpportunityDetector,
    detect_opportunities,
)
from app.insights.risk_detector import RiskDetector, detect_risks
from app.insights.trend_detector import TrendDetector, detect_trends

__all__ = [
    "AnomalyDetector",
    "InsightGenerator",
    "OpportunityDetector",
    "RiskDetector",
    "TrendDetector",
    "detect_anomalies",
    "detect_opportunities",
    "detect_risks",
    "detect_trends",
    "explain_insight",
    "generate_daily_insights",
    "generate_weekly_report",
]