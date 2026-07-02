"""Healing Service — service-layer bridge for the self-healing subsystem."""

from __future__ import annotations

from typing import Any

from app.self_healing.health_monitor import get_health_monitor
from app.self_healing.recovery_engine import get_recovery_engine


async def get_system_health() -> dict[str, Any]:
    monitor = get_health_monitor()
    return await monitor.get_system_health()


async def get_agent_health() -> dict[str, Any]:
    monitor = get_health_monitor()
    return await monitor.get_agent_health()


async def get_workflow_health() -> dict[str, Any]:
    monitor = get_health_monitor()
    return await monitor.get_workflow_health()


async def get_full_health_report() -> dict[str, Any]:
    monitor = get_health_monitor()
    return await monitor.get_full_report()


async def recover_component(component: str) -> dict[str, Any]:
    engine = get_recovery_engine()
    return await engine.recover(component)


async def replay_dead_letters() -> dict[str, Any]:
    engine = get_recovery_engine()
    return await engine.replay_dead_letters()


async def get_recovery_history(limit: int = 50) -> list[dict[str, Any]]:
    engine = get_recovery_engine()
    return engine.get_history(limit)


async def get_health_metrics() -> dict[str, Any]:
    from app.self_healing.metrics import get_metrics_collector
    collector = get_metrics_collector()
    return collector.get_all_metrics()


async def get_anomalies(limit: int = 50) -> list[dict[str, Any]]:
    from app.self_healing.anomaly_monitor import get_anomaly_monitor
    monitor = get_anomaly_monitor()
    return monitor.get_anomalies(limit)
