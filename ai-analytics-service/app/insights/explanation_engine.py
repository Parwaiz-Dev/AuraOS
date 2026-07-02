"""Explanation Engine — generates human-readable explanations for insights.

Converts structured anomaly/trend/opportunity/risk results into
natural-language summaries suitable for display in the dashboard
or inclusion in notification emails.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def explain_insight(insight_type: str, data: dict[str, Any]) -> str:
    """Generate a human-readable explanation for a single insight.

    Args:
        insight_type: One of anomaly, trend, opportunity, risk.
        data: The structured data dict for the insight.

    Returns:
        A plain-text explanation string.
    """
    handlers: dict[str, Any] = {
        "anomaly": _explain_anomaly,
        "trend": _explain_trend,
        "opportunity": _explain_opportunity,
        "risk": _explain_risk,
    }

    handler = handlers.get(insight_type)
    if handler is None:
        return f"Unknown insight type: {insight_type}"

    try:
        return handler(data)
    except Exception:
        logger.exception("Failed to explain %s insight", insight_type)
        return "Unable to generate explanation for this insight."


def _explain_anomaly(data: dict[str, Any]) -> str:
    """Explain an anomaly detection result."""
    anomaly_type = data.get("type", "unknown")
    severity = data.get("severity", "unknown")
    metric = data.get("metric", "unknown")
    current = data.get("current_value", 0)
    expected = data.get("expected_value", 0)
    deviation = data.get("deviation_pct", 0)
    description = data.get("description", "")

    severity_prefix = {
        "critical": "🚨 CRITICAL: ",
        "high": "⚠️ WARNING: ",
        "medium": "📊 NOTICE: ",
        "low": "ℹ️ INFO: ",
    }.get(severity, "")

    if description:
        return f"{severity_prefix}{description}"

    # Build fallback explanation
    direction = "increased" if deviation > 0 else "decreased"
    return (
        f"{severity_prefix}Anomaly detected in {metric}: "
        f"{direction} by {abs(deviation):.1f}% "
        f"(current: {current:,.0f}, expected: {expected:,.0f})"
    )


def _explain_trend(data: dict[str, Any]) -> str:
    """Explain a trend detection result."""
    metric = data.get("metric", "unknown")
    direction = data.get("direction", "stable")
    change_pct = data.get("change_pct", 0)
    period = data.get("period", "week")
    description = data.get("description", "")

    if description:
        return description

    direction_word = {
        "up": "increased",
        "down": "decreased",
        "stable": "remained stable",
    }.get(direction, "changed")

    if direction == "stable":
        return f"{metric.replace('_', ' ').title()} remained stable over the last {period}."

    return (
        f"{metric.replace('_', ' ').title()} {direction_word} "
        f"by {abs(change_pct):.1f}% over the last {period}."
    )


def _explain_opportunity(data: dict[str, Any]) -> str:
    """Explain an opportunity detection result."""
    detail = data.get("detail", "")
    recommendation = data.get("recommendation", "")

    if detail and recommendation:
        return f"💡 OPPORTUNITY: {detail}. {recommendation}"

    if detail:
        return f"💡 OPPORTUNITY: {detail}"

    return "An opportunity was identified but details are unavailable."


def _explain_risk(data: dict[str, Any]) -> str:
    """Explain a risk detection result."""
    risk_type = data.get("type", "unknown")
    severity = data.get("severity", "unknown")
    detail = data.get("detail", "")
    recommendation = data.get("recommendation", "")
    probability = data.get("probability", 0)

    severity_emoji = {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢",
    }.get(severity, "⚪")

    prob_str = f" (probability: {probability:.0%})" if probability > 0 else ""

    risk_labels = {
        "churn_risk": "Customer Churn Risk",
        "stockout_risk": "Inventory Stockout Risk",
        "revenue_decline_risk": "Revenue Decline Risk",
    }
    label = risk_labels.get(risk_type, risk_type.replace("_", " ").title())

    parts = [f"{severity_emoji} {label}{prob_str}"]
    if detail:
        parts.append(f"  → {detail}")
    if recommendation:
        parts.append(f"  → Action: {recommendation}")

    return "\n".join(parts)


def generate_daily_summary(
    anomaly_count: int,
    trend_count: int,
    opportunity_count: int,
    risk_count: int,
    restaurant_name: str = "Your restaurant",
) -> str:
    """Generate a concise daily summary paragraph.

    Args:
        anomaly_count: Number of anomalies detected.
        trend_count: Number of trends detected.
        opportunity_count: Number of opportunities detected.
        risk_count: Number of risks detected.

    Returns:
        A natural-language summary of today's insights.
    """
    total = anomaly_count + trend_count + opportunity_count + risk_count

    if total == 0:
        return (
            f"📋 Daily Insight Report for {restaurant_name}\n\n"
            "No significant insights detected today. "
            "All metrics are within normal ranges. Keep up the good work!"
        )

    lines = [f"📋 Daily Insight Report for {restaurant_name}\n"]

    if anomaly_count > 0:
        lines.append(
            f"🔍 {anomaly_count} anomaly/anomalies detected. "
            "Review the anomalies section for details on revenue drops, "
            "order spikes, or inventory shortages."
        )
    if trend_count > 0:
        lines.append(
            f"📈 {trend_count} trend(s) identified. "
            "Check the trends section for week-over-week and month-over-month changes."
        )
    if opportunity_count > 0:
        lines.append(
            f"💡 {opportunity_count} growth opportunity/opportunities found. "
            "See the opportunities section for actionable recommendations."
        )
    if risk_count > 0:
        lines.append(
            f"⚠️ {risk_count} risk(s) require attention. "
            "Visit the risks section to review churn, stockout, and revenue decline risks."
        )

    lines.append(
        f"\nTotal: {total} insight(s) generated today. "
        "Review each section for detailed recommendations."
    )

    return "\n".join(lines)


def generate_weekly_summary(
    anomaly_count: int,
    trend_count: int,
    opportunity_count: int,
    risk_count: int,
    total_revenue: float = 0.0,
    restaurant_name: str = "Your restaurant",
) -> str:
    """Generate a weekly report summary.

    Args:
        anomaly_count: Number of anomalies detected this week.
        trend_count: Number of trends detected.
        opportunity_count: Number of opportunities.
        risk_count: Number of risks.
        total_revenue: Total revenue for the week.
        restaurant_name: Display name.

    Returns:
        A formatted weekly report summary.
    """
    lines = [
        f"📊 Weekly AI Report for {restaurant_name}",
        "=" * 50,
        "",
    ]

    if total_revenue > 0:
        lines.append(f"💰 Total Revenue: ₹{total_revenue:,.0f}")

    lines.append("")
    lines.append(f"🔍 Anomalies: {anomaly_count}")
    lines.append(f"📈 Trends: {trend_count}")
    lines.append(f"💡 Opportunities: {opportunity_count}")
    lines.append(f"⚠️ Risks: {risk_count}")
    lines.append("")

    total = anomaly_count + trend_count + opportunity_count + risk_count

    if total == 0:
        lines.append("✅ All metrics are stable. No significant changes detected this week.")
    elif risk_count > 0:
        lines.append(f"⚠️ {risk_count} risk(s) need immediate attention. Review the full report for action items.")
        if opportunity_count > 0:
            lines.append(f"💡 {opportunity_count} growth opportunity/opportunities are also available.")
    elif opportunity_count > 0:
        lines.append(f"💡 {opportunity_count} growth opportunity/opportunities identified. Consider acting on them this week.")
    elif trend_count > 0:
        lines.append(f"📈 {trend_count} trend(s) detected. Review for strategic insights.")

    lines.append("")
    lines.append("Generated by AuraOS AI Analytics")

    return "\n".join(lines)