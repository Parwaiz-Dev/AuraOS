"""Reporting Agent — generates structured reports."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class ReportingAgent(SpecializedAgent):
    agent_id = "reporting_agent"
    name = "Reporting Agent"
    description = "Generates structured analytics and weekly reports"
    capabilities = ["reporting", "weekly_report", "summary"]
    supported_events = ["InsightGenerated"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.insight_service import get_weekly_report
            report = await get_weekly_report(session, rid)
            return {"report_generated": True, "summary": report.get("summary", ""), "source": self.agent_id}
