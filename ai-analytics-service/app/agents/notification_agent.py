"""Notification Agent — alert dispatch coordination."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent


class NotificationAgent(SpecializedAgent):
    agent_id = "notification_agent"
    name = "Notification Agent"
    description = "Notification dispatch via email, webhook, and dashboard alerts"
    capabilities = ["notifications", "email", "webhook", "alerts"]
    supported_events = ["InsightGenerated", "NotificationSent", "InventoryLow"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        return {
            "notified": False,
            "source": self.agent_id,
            "reason": "not_implemented — notification dispatch is not yet wired to a "
                      "real delivery channel (email/webhook). This agent will report "
                      "honestly until the integration is built.",
        }
