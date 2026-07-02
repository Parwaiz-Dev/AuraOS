"""Marketing Agent — promotion strategies and campaign suggestions."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class MarketingAgent(SpecializedAgent):
    agent_id = "marketing_agent"
    name = "Marketing Agent"
    description = "Promotion strategies, campaign suggestions, and marketing insights"
    capabilities = ["marketing", "promotions", "campaigns"]
    supported_events = ["InsightGenerated", "RecommendationGenerated"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.insight_service import get_daily_insights
            insights = await get_daily_insights(session, rid)
            opportunities = insights.get("counts", {}).get("opportunities", 0)
            return {"opportunities": opportunities, "source": self.agent_id}
