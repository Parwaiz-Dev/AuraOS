"""Agent Registry — stores and retrieves specialized agents."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.agents.base_agent import SpecializedAgent

logger = logging.getLogger(__name__)

_agents: dict[str, "SpecializedAgent"] = {}


def register_agent(agent: "SpecializedAgent") -> None:
    _agents[agent.agent_id] = agent
    logger.debug("Registered agent: %s (%s)", agent.agent_id, agent.name)


def get_agent(agent_id: str) -> "SpecializedAgent | None":
    return _agents.get(agent_id)


def get_all_agents() -> dict[str, "SpecializedAgent"]:
    return dict(_agents)


def get_agents_by_capability(capability: str) -> list["SpecializedAgent"]:
    return [a for a in _agents.values() if capability in a.capabilities]


def get_agents_by_event(event_name: str) -> list["SpecializedAgent"]:
    return [a for a in _agents.values() if event_name in a.supported_events]


def list_agent_info() -> list[dict[str, Any]]:
    return [a.get_info().model_dump(mode="json") for a in _agents.values()]


def clear_agents() -> None:
    _agents.clear()
