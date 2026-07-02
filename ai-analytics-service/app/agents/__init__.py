"""Multi-Agent AI System — Milestone 11.

Preserves existing Milestone 8 agents (BaseAgent, RevenueAgent, InventoryAgent)
and adds the new collaborative multi-agent platform with coordinator, messaging,
memory, and 13 specialized agents.
"""

from app.agents.base_agent import BaseAgent, SpecializedAgent, agent_session
from app.agents.coordinator import AgentCoordinator, get_coordinator, reset_coordinator
from app.agents.memory import reset_memory
from app.agents.messaging import reset_messaging
from app.agents.registry import (
    clear_agents,
    get_agent,
    get_agents_by_capability,
    get_agents_by_event,
    get_all_agents,
    list_agent_info,
    register_agent,
)
from app.agents.task_manager import reset_tasks

# ── Register all specialized agents ──────────────────────────────────────────

from app.agents.analytics_agent import AnalyticsAgent
from app.agents.copilot_agent import CopilotAgent
from app.agents.customer_agent import CustomerAgent
from app.agents.forecasting_agent import ForecastingAgent
from app.agents.inventory_agent import InventoryAgent as _LegacyInventoryAgent
from app.agents.marketing_agent import MarketingAgent
from app.agents.monitoring_agent import MonitoringAgent
from app.agents.notification_agent import NotificationAgent
from app.agents.operations_agent import OperationsAgent
from app.agents.rag_agent import RAGAgent
from app.agents.recommendation_agent import RecommendationAgent
from app.agents.reporting_agent import ReportingAgent
from app.agents.revenue_agent import RevenueAgent as _LegacyRevenueAgent

# New inventory agent for the multi-agent system
from app.agents.base_agent import SpecializedAgent as _SA
from typing import Any as _Any


class InventorySpecializedAgent(_SA):
    agent_id = "inventory_agent"
    name = "Inventory Agent"
    description = "Inventory prediction, stockout risk, and reorder recommendations"
    capabilities = ["inventory", "stockout", "reorder"]
    supported_events = ["InventoryLow", "InventoryUpdated"]

    async def process(self, params: dict[str, _Any]) -> dict[str, _Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.inventory_service import get_inventory_predictions
            result = await get_inventory_predictions(session, rid)
            return {"items": len(result) if result else 0, "source": self.agent_id}


class RevenueSpecializedAgent(_SA):
    agent_id = "revenue_agent"
    name = "Revenue Agent"
    description = "Revenue analytics, trends, and growth tracking"
    capabilities = ["revenue", "trends", "growth"]
    supported_events = ["OrderCompleted", "PaymentCompleted"]

    async def process(self, params: dict[str, _Any]) -> dict[str, _Any]:
        rid = params.get("restaurant_id", "")
        async with agent_session() as session:
            from app.services.revenue_service import get_daily_revenue
            result = await get_daily_revenue(session, rid, limit=7)
            return {"days": len(result) if result else 0, "source": self.agent_id}


def _register_all() -> None:
    """Register all specialized agents."""
    for cls in [
        AnalyticsAgent,
        RevenueSpecializedAgent,
        ForecastingAgent,
        InventorySpecializedAgent,
        CustomerAgent,
        RecommendationAgent,
        MarketingAgent,
        OperationsAgent,
        NotificationAgent,
        RAGAgent,
        CopilotAgent,
        ReportingAgent,
        MonitoringAgent,
    ]:
        register_agent(cls())


_register_all()

__all__ = [
    "BaseAgent",
    "SpecializedAgent",
    "AgentCoordinator",
    "agent_session",
    "get_coordinator",
    "reset_coordinator",
    "register_agent",
    "get_agent",
    "get_all_agents",
    "get_agents_by_capability",
    "get_agents_by_event",
    "list_agent_info",
    "clear_agents",
    "reset_memory",
    "reset_messaging",
    "reset_tasks",
]
