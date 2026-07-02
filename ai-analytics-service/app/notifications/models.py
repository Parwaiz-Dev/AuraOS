"""Notification data models — structured alert and notification types."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class Alert:
    """A single alert that may trigger a notification.

    Attributes:
        alert_type: Category (revenue_drop, inventory_shortage, churn_risk, etc.)
        severity: low, medium, high, critical
        title: Short human-readable title.
        detail: Detailed description of the alert.
        recommendation: Actionable recommendation.
        metadata: Arbitrary key-value data for templating.
    """

    alert_type: str
    severity: str
    title: str
    detail: str = ""
    recommendation: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Notification:
    """A notification ready for delivery.

    Attributes:
        id: Unique notification ID.
        restaurant_id: Target restaurant.
        alerts: List of alerts bundled in this notification.
        created_at: ISO 8601 timestamp.
        channel: email or webhook.
        sent: Whether the notification was successfully sent.
        error: Error message if delivery failed.
    """

    id: str
    restaurant_id: str
    alerts: list[Alert] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    channel: str = "email"
    sent: bool = False
    error: str = ""


@dataclass
class WebhookPayload:
    """JSON payload sent to the webhook endpoint.

    Follows a standard structure for external integrations.
    """

    event: str  # daily_insight, weekly_report, alert
    restaurant_id: str
    timestamp: str
    data: dict[str, Any] = field(default_factory=dict)
    signature: str = ""  # HMAC-SHA256 signature for verification