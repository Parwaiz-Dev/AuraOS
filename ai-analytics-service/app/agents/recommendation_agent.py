"""Recommendation Agent — item recommendations via association rules."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class RecommendationAgent(SpecializedAgent):
    agent_id = "recommendation_agent"
    name = "Recommendation Agent"
    description = "Item recommendations based on co-occurrence analysis"
    capabilities = ["recommendations", "upsell", "cross_sell"]
    supported_events = ["OrderCompleted", "RecommendationGenerated"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        limit = params.get("limit", 10)
        async with agent_session() as session:
            from app.services.recommendation_service import get_recommendations
            recs = await get_recommendations(session, rid, limit=limit)
            return {"recommendation_count": len(recs) if recs else 0, "source": self.agent_id}
