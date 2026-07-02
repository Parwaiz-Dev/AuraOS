"""Webhook Notifier — delivers insights to external HTTP endpoints.

Sends JSON payloads with HMAC-SHA256 signatures for verification.
Configured via WEBHOOK_URL and WEBHOOK_SECRET settings.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.notifications.models import Notification, WebhookPayload

if TYPE_CHECKING:
    import httpx

logger = logging.getLogger(__name__)


class WebhookNotifier:
    """Sends webhook notifications to configured HTTP endpoint."""

    def __init__(self) -> None:
        self._url = settings.WEBHOOK_URL
        self._secret = settings.WEBHOOK_SECRET
        self._enabled = settings.NOTIFY_ENABLED and bool(self._url)

    @property
    def is_configured(self) -> bool:
        """Return True if webhook URL is configured."""
        return bool(self._url)

    @staticmethod
    def _sign_payload(payload: dict, secret: str) -> str:
        """Generate HMAC-SHA256 signature for the payload."""
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        sig = hmac.new(
            secret.encode("utf-8"),
            raw.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return sig

    def _build_payload(self, notification: Notification) -> WebhookPayload:
        """Build a webhook payload from a notification."""
        data = {
            "notification_id": notification.id,
            "alerts": [
                {
                    "type": a.alert_type,
                    "severity": a.severity,
                    "title": a.title,
                    "detail": a.detail,
                    "recommendation": a.recommendation,
                }
                for a in notification.alerts
            ],
        }

        payload = WebhookPayload(
            event="alert",
            restaurant_id=notification.restaurant_id,
            timestamp=notification.created_at,
            data=data,
        )

        if self._secret:
            payload.signature = self._sign_payload(
                {
                    "event": payload.event,
                    "restaurant_id": payload.restaurant_id,
                    "timestamp": payload.timestamp,
                    "data": payload.data,
                },
                self._secret,
            )

        return payload

    async def send(self, notification: Notification) -> bool:
        """Send a webhook notification.

        Args:
            notification: The notification to send.

        Returns:
            True if sent successfully, False otherwise.
        """
        if not self._enabled:
            logger.info(
                "Webhook notifications disabled — would send to %s",
                self._url or "(no URL configured)",
            )
            return True  # Not an error — just disabled

        if not self.is_configured:
            logger.warning("Webhook URL not configured, cannot send webhook")
            notification.error = "Webhook URL not configured"
            return False

        try:
            import httpx

            payload = self._build_payload(notification)
            body = {
                "event": payload.event,
                "restaurant_id": payload.restaurant_id,
                "timestamp": payload.timestamp,
                "data": payload.data,
                "signature": payload.signature,
            }

            headers = {
                "Content-Type": "application/json",
                "X-AuraOS-Signature": payload.signature,
                "X-AuraOS-Event": payload.event,
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self._url,
                    json=body,
                    headers=headers,
                )

            if 200 <= response.status_code < 300:
                logger.info("Webhook sent successfully (HTTP %d)", response.status_code)
                notification.sent = True
                return True

            logger.warning(
                "Webhook returned non-2xx: HTTP %d — %s",
                response.status_code,
                response.text[:200],
            )
            notification.error = f"Webhook returned HTTP {response.status_code}"
            return False

        except Exception:
            logger.exception("Failed to send webhook to %s", self._url)
            notification.error = "Webhook delivery failed"
            return False