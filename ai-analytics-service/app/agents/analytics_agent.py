"""Analytics Agent — general analytics and insight generation."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class AnalyticsAgent(SpecializedAgent):
    agent_id = "analytics_agent"
    name = "Analytics Agent"
    description = "General analytics, dashboard KPIs, and insight generation"
    capabilities = ["analytics", "insights", "dashboard", "kpis"]
    supported_events = ["OrderCompleted", "InsightGenerated"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.insight_service import get_daily_insights
            result = await get_daily_insights(session, rid)
            return {"insights": result.get("counts", {}), "source": self.agent_id}
