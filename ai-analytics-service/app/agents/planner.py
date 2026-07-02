"""Agent Planner — decomposes requests into agent subtasks."""

from __future__ import annotations

import logging
from typing import Any

from app.agents.models import SubTask
from app.agents.registry import get_agents_by_capability

logger = logging.getLogger(__name__)

_DOMAIN_MAP: dict[str, str] = {
    "revenue": "revenue_agent",
    "forecast": "forecasting_agent",
    "orders": "forecasting_agent",
    "customers": "customer_agent",
    "inventory": "inventory_agent",
    "recommendations": "recommendation_agent",
    "marketing": "marketing_agent",
    "operations": "operations_agent",
    "notifications": "notification_agent",
    "rag": "rag_agent",
    "copilot": "copilot_agent",
    "report": "reporting_agent",
    "monitoring": "monitoring_agent",
    "analytics": "analytics_agent",
    "insights": "analytics_agent",
    "drift": "monitoring_agent",
    "model": "monitoring_agent",
}


def plan_subtasks(request: str, restaurant_id: str) -> list[SubTask]:
    """Decompose a request into subtasks assigned to agents."""
    request_lower = request.lower()

    assigned_agents: list[str] = []
    for keyword, agent_id in _DOMAIN_MAP.items():
        if keyword in request_lower and agent_id not in assigned_agents:
            assigned_agents.append(agent_id)

    if not assigned_agents:
        assigned_agents = ["analytics_agent"]

    subtasks = []
    for agent_id in assigned_agents:
        subtasks.append(SubTask(
            agent_id=agent_id,
            action="process",
            parameters={"request": request, "restaurant_id": restaurant_id},
        ))

    logger.info("Planned %d subtasks for request: %s", len(subtasks), request[:80])
    return subtasks
