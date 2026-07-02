"""Operations Agent — wait time and kitchen load analysis."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class OperationsAgent(SpecializedAgent):
    agent_id = "operations_agent"
    name = "Operations Agent"
    description = "Kitchen load, wait time analysis, and operational efficiency"
    capabilities = ["operations", "wait_time", "kitchen_load"]
    supported_events = ["OrderCreated", "OrderCompleted"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.wait_time_service import get_wait_time
            wait = await get_wait_time(session, rid)
            return {"wait_time": wait, "source": self.agent_id}
