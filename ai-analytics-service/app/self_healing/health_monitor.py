"""Health Monitor — top-level orchestrator for system health checks."""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class HealthMonitor:
    """Aggregates health status across all system components."""

    async def get_system_health(self) -> dict[str, Any]:
        from app.self_healing.dependency_checker import get_dependency_checker
        from app.self_healing.metrics import get_metrics_collector

        checker = get_dependency_checker()
        deps = await checker.check_all()

        healthy_count = sum(1 for d in deps.values() if d.healthy)
        total = len(deps)

        collector = get_metrics_collector()
        system_metrics = collector.get_system_metrics()

        overall = "healthy" if healthy_count == total else (
            "degraded" if healthy_count > 0 else "unhealthy"
        )

        return {
            "status": overall,
            "healthy_components": healthy_count,
            "total_components": total,
            "components": {
                name: ds.to_dict() for name, ds in deps.items()
            },
            "system": system_metrics,
        }

    async def get_agent_health(self) -> dict[str, Any]:
        try:
            from app.agents.registry import get_all_agents
            agents = get_all_agents()
            infos = []
            for agent in agents.values():
                info = agent.get_info()
                infos.append(info.model_dump(mode="json") if hasattr(info, "model_dump") else info)

            healthy = sum(1 for a in agents.values() if a.status != "FAILED")
            return {
                "total": len(agents),
                "healthy": healthy,
                "failed": len(agents) - healthy,
                "agents": infos,
            }
        except Exception as exc:
            return {"total": 0, "healthy": 0, "failed": 0, "error": str(exc)}

    async def get_workflow_health(self) -> dict[str, Any]:
        try:
            from app.workflows.workflow_executor import get_workflow_stats
            stats = await get_workflow_stats()

            from app.self_healing.circuit_breaker import get_all_breakers
            breakers = {
                name: cb.get_stats()
                for name, cb in get_all_breakers().items()
            }

            return {
                "workflow_stats": stats,
                "circuit_breakers": breakers,
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def get_full_report(self) -> dict[str, Any]:
        import asyncio
        system, agents, workflows = await asyncio.gather(
            self.get_system_health(),
            self.get_agent_health(),
            self.get_workflow_health(),
            return_exceptions=True,
        )

        from app.self_healing.metrics import get_metrics_collector
        collector = get_metrics_collector()
        metrics = collector.get_all_metrics()

        from app.self_healing.recovery_engine import get_recovery_engine
        recovery = get_recovery_engine()

        from app.self_healing.watchdog import get_watchdog
        watchdog = get_watchdog()

        return {
            "system": system if not isinstance(system, Exception) else {"error": str(system)},
            "agents": agents if not isinstance(agents, Exception) else {"error": str(agents)},
            "workflows": workflows if not isinstance(workflows, Exception) else {"error": str(workflows)},
            "metrics": metrics,
            "recovery": recovery.get_stats(),
            "watchdog": watchdog.get_stats(),
        }


_monitor: HealthMonitor | None = None


def get_health_monitor() -> HealthMonitor:
    global _monitor
    if _monitor is None:
        _monitor = HealthMonitor()
    return _monitor


def reset_health_monitor() -> None:
    global _monitor
    _monitor = None
