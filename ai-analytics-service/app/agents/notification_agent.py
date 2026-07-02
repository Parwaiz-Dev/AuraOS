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
        rid = params.get("restaurant_id", "")
        try:
            from app.events.domain_events import NotificationSent
            from app.events.publisher import publish
            await publish(NotificationSent(restaurant_id=rid, channel="webhook", success=True))
            return {"notified": True, "source": self.agent_id}
        except Exception:
            return {"notified": False, "source": self.agent_id}
