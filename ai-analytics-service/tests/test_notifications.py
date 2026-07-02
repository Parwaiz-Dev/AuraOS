"""Tests for Notification System — Milestone 6.

Covers:
    EmailNotifier configuration and building
    WebhookNotifier payload signing
    NotificationService alert building
    Notification models
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

from app.notifications.models import Alert, Notification, WebhookPayload
from app.notifications.email_notifier import EmailNotifier
from app.notifications.webhook_notifier import WebhookNotifier
from app.notifications.notification_service import NotificationService


class TestAlert:
    """Unit tests for Alert model."""

    def test_alert_creation(self) -> None:
        alert = Alert(
            alert_type="anomaly_revenue",
            severity="high",
            title="Revenue Anomaly Detected",
            detail="Revenue spiked 150% above expected",
            recommendation="Investigate unusual transaction patterns",
            metadata={"current_value": 15000.0, "expected_value": 10000.0},
        )
        assert alert.alert_type == "anomaly_revenue"
        assert alert.severity == "high"
        assert alert.title == "Revenue Anomaly Detected"

    def test_alert_with_empty_metadata(self) -> None:
        alert = Alert(
            alert_type="risk_churn",
            severity="medium",
            title="Churn Risk",
            detail="Customer at risk of churning",
            recommendation="Send re-engagement offer",
        )
        assert alert.metadata == {}


class TestNotification:
    """Unit tests for Notification model."""

    def test_notification_defaults(self) -> None:
        n = Notification(
            id="notif_1",
            restaurant_id="rest_1",
        )
        assert n.id == "notif_1"
        assert n.restaurant_id == "rest_1"
        assert n.alerts == []
        assert n.sent is False
        assert n.channel == "email"  # default is "email"
        assert n.error == ""

    def test_notification_with_alerts(self) -> None:
        alert = Alert(
            alert_type="anomaly_orders",
            severity="critical",
            title="Order Spike",
            detail="Orders jumped 200%",
            recommendation="Check for fraud",
        )
        n = Notification(
            id="notif_2",
            restaurant_id="rest_2",
            alerts=[alert],
        )
        assert len(n.alerts) == 1


class TestWebhookPayload:
    """Unit tests for WebhookPayload model."""

    def test_webhook_payload_creation(self) -> None:
        p = WebhookPayload(
            event="daily_insight",
            restaurant_id="rest_1",
            timestamp="2026-06-01T08:00:00",
            data={"anomalies": 2, "risks": 1},
        )
        assert p.event == "daily_insight"
        assert p.restaurant_id == "rest_1"
        assert p.data["anomalies"] == 2
        assert p.signature == ""  # default


class TestEmailNotifier:
    """Unit tests for EmailNotifier."""

    def test_email_notifier_init(self) -> None:
        notifier = EmailNotifier()
        assert notifier is not None

    def test_build_subject_with_critical_alert(self) -> None:
        notifier = EmailNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
            alerts=[
                Alert(
                    alert_type="anomaly_revenue",
                    severity="critical",
                    title="Revenue Crash",
                    detail="Revenue dropped 50%",
                    recommendation="Investigate immediately",
                ),
            ],
        )
        subject = notifier._build_subject(notification)
        assert "Revenue Crash" in subject

    def test_build_subject_with_high_alert(self) -> None:
        notifier = EmailNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
            alerts=[
                Alert(
                    alert_type="risk_churn",
                    severity="high",
                    title="Customer Churn Risk",
                    detail="5 customers at risk",
                    recommendation="Send re-engagement",
                ),
            ],
        )
        subject = notifier._build_subject(notification)
        assert "Customer Churn Risk" in subject

    def test_build_subject_no_alerts(self) -> None:
        notifier = EmailNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
        )
        subject = notifier._build_subject(notification)
        assert "Daily Update" in subject

    def test_build_html_body(self) -> None:
        notifier = EmailNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
            alerts=[
                Alert(
                    alert_type="anomaly_revenue",
                    severity="high",
                    title="Revenue Anomaly",
                    detail="Revenue dropped 30%",
                    recommendation="Review pricing",
                ),
            ],
        )
        html = notifier._build_html_body(notification)
        assert "Revenue Anomaly" in html
        assert "Revenue dropped 30%" in html

    def test_build_plain_body(self) -> None:
        notifier = EmailNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
            alerts=[
                Alert(
                    alert_type="risk_churn",
                    severity="medium",
                    title="Churn Risk",
                    detail="Customer inactive for 45 days",
                    recommendation="Send discount",
                ),
            ],
        )
        plain = notifier._build_plain_body(notification)
        assert "Churn Risk" in plain
        assert "Customer inactive for 45 days" in plain

    @pytest.mark.asyncio
    async def test_send_not_enabled(self) -> None:
        """send() should not attempt SMTP when NOTIFY_ENABLED is False."""
        notifier = EmailNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
        )

        with patch.object(notifier, "_enabled", False):
            with patch("smtplib.SMTP") as mock_smtp:
                await notifier.send(notification, "test@example.com")
                mock_smtp.assert_not_called()


class TestWebhookNotifier:
    """Unit tests for WebhookNotifier."""

    def test_webhook_notifier_init(self) -> None:
        notifier = WebhookNotifier()
        assert notifier is not None

    def test_sign_payload_consistency(self) -> None:
        payload = {"event": "test", "restaurant_id": "rest_1"}
        secret = "my-secret-key"
        sig1 = WebhookNotifier._sign_payload(payload, secret)
        sig2 = WebhookNotifier._sign_payload(payload, secret)
        assert sig1 == sig2  # Same input → same signature

    def test_sign_payload_different(self) -> None:
        secret = "my-secret-key"
        sig1 = WebhookNotifier._sign_payload({"event": "a"}, secret)
        sig2 = WebhookNotifier._sign_payload({"event": "b"}, secret)
        assert sig1 != sig2  # Different input → different signature

    @pytest.mark.asyncio
    async def test_send_not_configured(self) -> None:
        """send() should not attempt HTTP when webhook URL is not configured."""
        notifier = WebhookNotifier()
        notification = Notification(
            id="notif_1",
            restaurant_id="rest_1",
        )

        with patch.object(
            WebhookNotifier, "is_configured", new_callable=PropertyMock, return_value=False
        ):
            import httpx
            with patch("httpx.AsyncClient") as mock_client:
                await notifier.send(notification)
                mock_client.assert_not_called()


class TestNotificationService:
    """Unit tests for NotificationService."""

    @pytest.mark.asyncio
    async def test_evaluate_and_notify_no_alerts(self) -> None:
        from app.insights.insight_generator import DailyInsight

        insight = DailyInsight(
            restaurant_id="rest_1",
            summary="All clear.",
        )

        service = NotificationService()
        with patch.object(service, "_enabled", True):
            notification = await service.evaluate_and_notify(insight)
            assert notification.sent is True
            assert len(notification.alerts) == 0

    @pytest.mark.asyncio
    async def test_evaluate_and_notify_disabled(self) -> None:
        from app.insights.insight_generator import DailyInsight

        insight = DailyInsight(
            restaurant_id="rest_1",
            summary="All clear.",
        )

        service = NotificationService()
        with patch.object(service, "_enabled", False):
            notification = await service.evaluate_and_notify(insight)
            assert notification.sent is True