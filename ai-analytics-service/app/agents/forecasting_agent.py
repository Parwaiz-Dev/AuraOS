"""Forecasting Agent — revenue and order forecasting."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class ForecastingAgent(SpecializedAgent):
    agent_id = "forecasting_agent"
    name = "Forecasting Agent"
    description = "Revenue and order volume forecasting using Prophet"
    capabilities = ["forecast", "revenue_forecast", "order_forecast"]
    supported_events = ["OrderCompleted", "RevenueForecastGenerated"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        days = params.get("days", 30)
        async with agent_session() as session:
            from app.services.revenue_forecast_service import get_revenue_forecast
            forecast = await get_revenue_forecast(session, rid, days=days)
            return {"forecast": "generated" if forecast else "insufficient_data", "source": self.agent_id}
