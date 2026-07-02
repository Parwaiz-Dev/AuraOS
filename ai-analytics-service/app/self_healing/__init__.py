"""Self-Healing AI Platform — Milestone 12.

Monitors component health, detects anomalies, and automatically recovers
from failures using circuit breakers, watchdogs, and failover strategies.
"""

from app.self_healing.circuit_breaker import CircuitBreaker, CircuitState
from app.self_healing.health_monitor import HealthMonitor, get_health_monitor, reset_health_monitor
from app.self_healing.metrics import HealthMetricsCollector, get_metrics_collector, reset_metrics_collector
from app.self_healing.recovery_engine import RecoveryEngine, get_recovery_engine, reset_recovery_engine

__all__ = [
    "CircuitBreaker",
    "CircuitState",
    "HealthMonitor",
    "HealthMetricsCollector",
    "RecoveryEngine",
    "get_health_monitor",
    "get_metrics_collector",
    "get_recovery_engine",
    "reset_health_monitor",
    "reset_metrics_collector",
    "reset_recovery_engine",
]
