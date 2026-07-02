"""Dependency Checker — verifies availability of external services."""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class DependencyStatus:
    __slots__ = ("name", "healthy", "latency_ms", "error", "last_checked")

    def __init__(self, name: str) -> None:
        self.name = name
        self.healthy = False
        self.latency_ms: float = 0.0
        self.error: str = ""
        self.last_checked: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "healthy": self.healthy,
            "latency_ms": round(self.latency_ms, 2),
            "error": self.error,
            "last_checked": self.last_checked,
        }


class DependencyChecker:
    """Check health of external dependencies: Redis, PostgreSQL, Qdrant, etc."""

    async def check_redis(self) -> DependencyStatus:
        ds = DependencyStatus("redis")
        t0 = time.monotonic()
        try:
            from app.config.redis_client import get_redis
            r = await get_redis()
            await r.ping()
            ds.healthy = True
        except Exception as exc:
            ds.error = str(exc)
        ds.latency_ms = (time.monotonic() - t0) * 1000
        ds.last_checked = time.monotonic()
        return ds

    async def check_database(self) -> DependencyStatus:
        ds = DependencyStatus("database")
        t0 = time.monotonic()
        try:
            from app.config.database import check_database_connection
            ds.healthy = await check_database_connection()
            if not ds.healthy:
                ds.error = "Connection check returned False"
        except Exception as exc:
            ds.error = str(exc)
        ds.latency_ms = (time.monotonic() - t0) * 1000
        ds.last_checked = time.monotonic()
        return ds

    async def check_event_bus(self) -> DependencyStatus:
        ds = DependencyStatus("event_bus")
        t0 = time.monotonic()
        try:
            from app.events.event_bus import get_event_bus
            bus = get_event_bus()
            ds.healthy = bus.is_running
            if not ds.healthy:
                ds.error = "Event bus is not running"
        except Exception as exc:
            ds.error = str(exc)
        ds.latency_ms = (time.monotonic() - t0) * 1000
        ds.last_checked = time.monotonic()
        return ds

    async def check_scheduler(self) -> DependencyStatus:
        ds = DependencyStatus("scheduler")
        t0 = time.monotonic()
        try:
            from app.scheduler.scheduler import is_scheduler_running
            ds.healthy = is_scheduler_running()
            if not ds.healthy:
                ds.error = "Scheduler is not running"
        except Exception as exc:
            ds.error = str(exc)
        ds.latency_ms = (time.monotonic() - t0) * 1000
        ds.last_checked = time.monotonic()
        return ds

    async def check_workflow_engine(self) -> DependencyStatus:
        ds = DependencyStatus("workflow_engine")
        t0 = time.monotonic()
        try:
            from app.workflows.workflow_engine import get_workflow_engine
            engine = get_workflow_engine()
            ds.healthy = engine is not None
        except Exception as exc:
            ds.error = str(exc)
        ds.latency_ms = (time.monotonic() - t0) * 1000
        ds.last_checked = time.monotonic()
        return ds

    async def check_agents(self) -> DependencyStatus:
        ds = DependencyStatus("agents")
        t0 = time.monotonic()
        try:
            from app.agents.registry import get_all_agents
            agents = get_all_agents()
            failed = sum(1 for a in agents.values() if a.status == "FAILED")
            ds.healthy = failed == 0 and len(agents) > 0
            if failed > 0:
                ds.error = f"{failed} agents in FAILED state"
        except Exception as exc:
            ds.error = str(exc)
        ds.latency_ms = (time.monotonic() - t0) * 1000
        ds.last_checked = time.monotonic()
        return ds

    async def check_all(self) -> dict[str, DependencyStatus]:
        import asyncio
        checks = await asyncio.gather(
            self.check_redis(),
            self.check_database(),
            self.check_event_bus(),
            self.check_scheduler(),
            self.check_workflow_engine(),
            self.check_agents(),
            return_exceptions=True,
        )
        names = ["redis", "database", "event_bus", "scheduler", "workflow_engine", "agents"]
        result: dict[str, DependencyStatus] = {}
        for name, check in zip(names, checks):
            if isinstance(check, Exception):
                ds = DependencyStatus(name)
                ds.error = str(check)
                result[name] = ds
            else:
                result[name] = check
        return result


_checker: DependencyChecker | None = None


def get_dependency_checker() -> DependencyChecker:
    global _checker
    if _checker is None:
        _checker = DependencyChecker()
    return _checker


def reset_dependency_checker() -> None:
    global _checker
    _checker = None
