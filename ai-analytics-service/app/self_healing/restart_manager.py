"""Restart Manager — safely restarts failed components."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

_MAX_RESTARTS_PER_WINDOW = 5
_RESTART_WINDOW_SECONDS = 300.0


class RestartManager:
    """Manages component restarts with rate limiting."""

    def __init__(self) -> None:
        self._restart_history: dict[str, list[float]] = defaultdict(list)
        self._total_restarts: dict[str, int] = defaultdict(int)

    def can_restart(self, component: str) -> bool:
        now = time.monotonic()
        history = self._restart_history[component]
        recent = [t for t in history if now - t < _RESTART_WINDOW_SECONDS]
        self._restart_history[component] = recent
        return len(recent) < _MAX_RESTARTS_PER_WINDOW

    async def restart_component(self, component: str) -> dict[str, Any]:
        if not self.can_restart(component):
            logger.warning("Restart rate limit reached for '%s'", component)
            return {"component": component, "restarted": False, "reason": "rate_limited"}

        self._restart_history[component].append(time.monotonic())
        self._total_restarts[component] += 1

        try:
            if component == "event_bus":
                return await self._restart_event_bus()
            elif component == "scheduler":
                return await self._restart_scheduler()
            elif component.startswith("agent:"):
                return await self._restart_agent(component.split(":", 1)[1])
            elif component == "redis":
                return await self._restart_redis()
            else:
                return {"component": component, "restarted": False, "reason": "unknown_component"}
        except Exception as exc:
            logger.error("Failed to restart '%s': %s", component, exc)
            return {"component": component, "restarted": False, "reason": str(exc)}

    async def _restart_event_bus(self) -> dict[str, Any]:
        from app.events.event_bus import get_event_bus
        bus = get_event_bus()
        await bus.stop()
        await bus.start()
        logger.info("Event bus restarted")
        return {"component": "event_bus", "restarted": True}

    async def _restart_scheduler(self) -> dict[str, Any]:
        from app.scheduler.scheduler import start_scheduler, stop_scheduler
        await stop_scheduler()
        await start_scheduler()
        logger.info("Scheduler restarted")
        return {"component": "scheduler", "restarted": True}

    async def _restart_agent(self, agent_id: str) -> dict[str, Any]:
        from app.agents.registry import get_agent
        agent = get_agent(agent_id)
        if agent is None:
            return {"component": f"agent:{agent_id}", "restarted": False, "reason": "not_found"}
        agent.restart()
        logger.info("Agent '%s' restarted", agent_id)
        return {"component": f"agent:{agent_id}", "restarted": True}

    async def _restart_redis(self) -> dict[str, Any]:
        from app.config.redis_client import close_redis, get_redis
        await close_redis()
        await get_redis()
        logger.info("Redis connection pool recycled")
        return {"component": "redis", "restarted": True}

    def get_stats(self) -> dict[str, Any]:
        return {
            "total_restarts": dict(self._total_restarts),
            "recent_restarts": {
                k: len(v) for k, v in self._restart_history.items()
            },
        }

    def reset(self) -> None:
        self._restart_history.clear()
        self._total_restarts.clear()


_manager: RestartManager | None = None


def get_restart_manager() -> RestartManager:
    global _manager
    if _manager is None:
        _manager = RestartManager()
    return _manager


def reset_restart_manager() -> None:
    global _manager
    _manager = None
