"""Revenue Agent — revenue analytics, trends, forecasting, and insights."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import BaseAgent


class RevenueAgent(BaseAgent):
    name = "RevenueAgent"
    domain = "revenue"

    async def gather(self, db: Any, restaurant_id: str, query: str) -> dict[str, Any]:
        from app.tools import revenue_tool

        return await revenue_tool(db, restaurant_id)
