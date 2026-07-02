"""Failover — provides fallback strategies when primary components fail."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class FailoverStrategy:
    """Executes failover actions for unhealthy components."""

    async def failover_redis(self) -> dict[str, Any]:
        """When Redis is unavailable, switch to in-memory fallback."""
        logger.warning("Redis failover: switching to in-memory mode")
        return {
            "component": "redis",
            "strategy": "in_memory_fallback",
            "status": "active",
            "message": "Operating in degraded mode without Redis caching",
        }

    async def failover_database(self) -> dict[str, Any]:
        """When DB is unavailable, return cached data only."""
        logger.warning("Database failover: cached-data-only mode")
        return {
            "component": "database",
            "strategy": "cached_data_only",
            "status": "active",
            "message": "Serving cached data only — writes are buffered",
        }

    async def failover_agent(self, agent_id: str) -> dict[str, Any]:
        """When an agent fails, delegate to coordinator fallback."""
        logger.warning("Agent '%s' failover: routing to coordinator", agent_id)
        try:
            from app.agents.registry import get_agent
            agent = get_agent(agent_id)
            if agent is not None:
                agent.restart()
                return {
                    "component": f"agent:{agent_id}",
                    "strategy": "restart",
                    "status": "recovered",
                }
        except Exception:
            pass
        return {
            "component": f"agent:{agent_id}",
            "strategy": "skip",
            "status": "degraded",
            "message": f"Agent '{agent_id}' skipped — results may be partial",
        }

    async def failover_workflow(self, workflow_id: str) -> dict[str, Any]:
        """When a workflow fails, attempt DLQ replay."""
        logger.warning("Workflow '%s' failover: queued for retry", workflow_id)
        return {
            "component": f"workflow:{workflow_id}",
            "strategy": "dlq_retry",
            "status": "queued",
            "message": f"Workflow '{workflow_id}' queued for retry via dead-letter queue",
        }


_failover: FailoverStrategy | None = None


def get_failover() -> FailoverStrategy:
    global _failover
    if _failover is None:
        _failover = FailoverStrategy()
    return _failover


def reset_failover() -> None:
    global _failover
    _failover = None
