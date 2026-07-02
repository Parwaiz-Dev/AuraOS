"""Customer Agent — customer segmentation and churn analysis."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class CustomerAgent(SpecializedAgent):
    agent_id = "customer_agent"
    name = "Customer Agent"
    description = "Customer segmentation, VIP identification, and churn risk analysis"
    capabilities = ["customers", "segmentation", "churn", "vip"]
    supported_events = ["CustomerCreated", "CustomerSegmentUpdated"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.customer_segmentation_service import get_customer_segments
            segments = await get_customer_segments(session, rid)
            count = len(segments) if segments else 0
            return {"customer_count": count, "source": self.agent_id}
