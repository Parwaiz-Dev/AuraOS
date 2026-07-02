"""Notification Service — determines which alerts to notify on and dispatches.

Evaluates anomalies, risks, and opportunities from insights and determines
whether they meet notification thresholds. Dispatches via email and/or webhook.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.notifications.email_notifier import EmailNotifier
from app.notifications.models import Alert, Notification
from app.notifications.webhook_notifier import WebhookNotifier

if TYPE_CHECKING:
    from app.insights.insight_generator import DailyInsight

logger = logging.getLogger(__name__)


class NotificationService:
    """Evaluates insights and dispatches notifications when thresholds are met."""

    def __init__(self) -> None:
        self._email_notifier = EmailNotifier()
        self._webhook_notifier = WebhookNotifier()
        self._enabled = settings.NOTIFY_ENABLED

    def _build_alerts_from_insights(
        self,
        insight: "DailyInsight",
    ) -> list[Alert]:
        """Convert insight results into notification alerts.

        Only includes items that meet severity/notification thresholds.
        """
        alerts: list[Alert] = []

        # Anomalies → Alerts
        for a in insight.anomalies.anomalies:
            if a.severity in ("critical", "high"):
                alerts.append(Alert(
                    alert_type=a.type,
                    severity=a.severity,
                    title=f"Anomaly: {a.type.replace('_', ' ').title()}",
                    detail=a.description,
                    recommendation="Review the anomaly in the AuraOS dashboard for detailed analysis.",
                    metadata={
                        "metric": a.metric,
                        "current_value": a.current_value,
                        "expected_value": a.expected_value,
                        "deviation_pct": a.deviation_pct,
                    },
                ))

        # Risks → Alerts (only medium and above)
        for r in insight.risks.risks:
            if r.severity in ("critical", "high", "medium"):
                alerts.append(Alert(
                    alert_type=r.type,
                    severity=r.severity,
                    title=f"Risk: {r.type.replace('_', ' ').title()}",
                    detail=r.detail,
                    recommendation=r.recommendation,
                    metadata={
                        "category": r.category,
                        "probability": r.probability,
                    },
                ))

        # Opportunities → Alerts (only high severity)
        for o in insight.opportunities.opportunities:
            if o.severity == "high":
                alerts.append(Alert(
                    alert_type=o.type,
                    severity="low",  # Opportunities are informational
                    title=f"Opportunity: {o.type.replace('_', ' ').title()}",
                    detail=o.detail,
                    recommendation=o.recommendation,
                    metadata={
                        "category": o.category,
                        "potential_value": o.potential_value,
                    },
                ))

        return alerts

    async def evaluate_and_notify(
        self,
        insight: "DailyInsight",
        recipient_email: str = "",
    ) -> Notification:
        """Evaluate insight results and dispatch notifications if warranted.

        Args:
            insight: The daily insight to evaluate.
            recipient_email: Optional email recipient override.

        Returns:
            A Notification record with delivery status.
        """
        notification_id = str(uuid.uuid4())
        notification = Notification(
            id=notification_id,
            restaurant_id=insight.restaurant_id,
            created_at=datetime.now().isoformat(),
        )

        # Build alerts from insights
        alerts = self._build_alerts_from_insights(insight)
        notification.alerts = alerts

        if not alerts:
            logger.info(
                "No alerts to notify for restaurant %s",
                insight.restaurant_id,
            )
            notification.sent = True  # Nothing to send = success
            return notification

        if not self._enabled:
            logger.info(
                "Notifications disabled — %d alert(s) would have been sent for restaurant %s",
                len(alerts),
                insight.restaurant_id,
            )
            notification.sent = True
            return notification

        # Dispatch via email
        if recipient_email and self._email_notifier.is_configured:
            notification.channel = "email"
            await self._email_notifier.send(notification, recipient_email)

        # Dispatch via webhook
        if self._webhook_notifier.is_configured:
            webhook_notification = Notification(
                id=notification_id,
                restaurant_id=insight.restaurant_id,
                alerts=alerts,
                created_at=notification.created_at,
                channel="webhook",
            )
            await self._webhook_notifier.send(webhook_notification)

        if not notification.sent and not self._webhook_notifier.is_configured:
            notification.error = "No notification channels configured"

        return notification


async def send_notifications(
    insight: "DailyInsight",
    recipient_email: str = "",
) -> Notification:
    """Convenience function to evaluate and send notifications for an insight."""
    service = NotificationService()
    result = await service.evaluate_and_notify(insight, recipient_email)

    # Milestone 8: Publish NotificationSent event
    try:
        from app.events.domain_events import NotificationSent
        from app.events.publisher import publish

        await publish(NotificationSent(
            restaurant_id=insight.restaurant_id,
            channel=result.channel,
            alert_count=len(result.alerts),
            success=result.sent,
        ))
    except Exception:
        pass

    return result