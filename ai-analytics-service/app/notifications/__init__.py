"""Notifications package — delivers insights via email and webhooks.

Modules:
    models                — Notification data models (Notification, Alert, WebhookPayload)
    email_notifier        — SMTP-based email notification delivery
    webhook_notifier      — HTTP webhook notification delivery
    notification_service  — Orchestrator that determines what to notify and dispatches
"""

from __future__ import annotations

from app.notifications.email_notifier import EmailNotifier
from app.notifications.models import Alert, Notification, WebhookPayload
from app.notifications.notification_service import (
    NotificationService,
    send_notifications,
)
from app.notifications.webhook_notifier import WebhookNotifier

__all__ = [
    "Alert",
    "EmailNotifier",
    "Notification",
    "NotificationService",
    "WebhookNotifier",
    "WebhookPayload",
    "send_notifications",
]