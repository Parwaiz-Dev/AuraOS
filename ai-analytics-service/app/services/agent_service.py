"""Agent Service — service layer for the multi-agent system."""

from __future__ import annotations

import logging
from typing import Any

from app.agents.coordinator import get_coordinator
from app.agents.memory import get_shared, store_shared
from app.agents.messaging import get_message_history, send_message
from app.agents.models import AgentMessage
from app.agents.registry import get_agent, list_agent_info
from app.agents.task_manager import get_tasks

logger = logging.getLogger(__name__)


async def get_agents() -> list[dict[str, Any]]:
    return list_agent_info()


async def get_agent_status() -> list[dict[str, Any]]:
    coordinator = get_coordinator()
    return await coordinator.get_agent_status()


async def get_agent_metrics() -> dict[str, Any]:
    coordinator = get_coordinator()
    return await coordinator.get_metrics()


async def get_agent_tasks(limit: int = 50) -> list[dict[str, Any]]:
    return get_tasks(limit=limit)


async def get_agent_history(limit: int = 50) -> list[dict[str, Any]]:
    return await get_message_history(limit=limit)


async def run_agent_request(
    request: str,
    restaurant_id: str,
    user_id: str = "",
) -> dict[str, Any]:
    coordinator = get_coordinator()
    return await coordinator.process_request(
        request=request,
        restaurant_id=restaurant_id,
        user_id=user_id,
    )


async def restart_agent(agent_id: str) -> bool:
    coordinator = get_coordinator()
    return await coordinator.restart_agent(agent_id)


async def send_agent_message(
    from_agent: str,
    to_agent: str,
    action: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    msg = AgentMessage(
        from_agent=from_agent,
        to_agent=to_agent,
        action=action,
        payload=payload or {},
        message_type="REQUEST",
    )
    return await send_message(msg)
