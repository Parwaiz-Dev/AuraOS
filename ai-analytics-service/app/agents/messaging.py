"""Agent Messaging — inter-agent communication via Event Bus."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Any

from app.agents.models import AgentMessage

logger = logging.getLogger(__name__)

_message_log: deque[dict[str, Any]] = deque(maxlen=1000)
_pending_responses: dict[str, asyncio.Future[dict[str, Any]]] = {}
_stats = {"total_sent": 0, "total_received": 0, "total_failed": 0}


async def send_message(message: AgentMessage) -> dict[str, Any] | None:
    """Send a message through the event bus. Returns response for REQUEST type."""
    _stats["total_sent"] += 1
    _message_log.appendleft(message.model_dump(mode="json"))

    try:
        from app.events.event import BaseEvent
        from app.events.publisher import publish

        await publish(BaseEvent(
            event_name="AgentMessage",
            restaurant_id="",
            metadata={
                "message_id": message.message_id,
                "from_agent": message.from_agent,
                "to_agent": message.to_agent,
                "action": message.action,
                "message_type": message.message_type,
            },
        ))
    except Exception:
        logger.debug("Failed to publish agent message event", exc_info=True)

    if message.message_type == "REQUEST":
        from app.agents.registry import get_agent
        target = get_agent(message.to_agent)
        if target is None:
            _stats["total_failed"] += 1
            return None

        for attempt in range(message.max_retries + 1):
            try:
                result = await asyncio.wait_for(
                    target.handle_message(message),
                    timeout=message.timeout_seconds,
                )
                message.acknowledged = True
                message.response = result
                _stats["total_received"] += 1
                return result
            except asyncio.TimeoutError:
                logger.warning(
                    "Message %s to %s timed out (attempt %d/%d)",
                    message.message_id, message.to_agent, attempt + 1, message.max_retries + 1,
                )
            except Exception:
                logger.warning(
                    "Message %s to %s failed (attempt %d/%d)",
                    message.message_id, message.to_agent, attempt + 1, message.max_retries + 1,
                    exc_info=True,
                )
            if attempt < message.max_retries:
                await asyncio.sleep(0.5 * (2 ** attempt))

        _stats["total_failed"] += 1
        return None

    if message.message_type == "BROADCAST":
        from app.agents.registry import get_all_agents
        agents = get_all_agents()
        for agent in agents.values():
            if agent.agent_id != message.from_agent:
                try:
                    await agent.handle_message(message)
                except Exception:
                    pass
        return None

    return None


async def get_message_history(limit: int = 50) -> list[dict[str, Any]]:
    return list(_message_log)[:limit]


def get_messaging_stats() -> dict[str, int]:
    return dict(_stats)


def reset_messaging() -> None:
    _message_log.clear()
    _pending_responses.clear()
    for key in _stats:
        _stats[key] = 0
