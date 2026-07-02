"""Tests for Self-Healing Engine — Milestone 12."""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.self_healing.anomaly_monitor import AnomalyMonitor, get_anomaly_monitor, reset_anomaly_monitor
from app.self_healing.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
    get_circuit_breaker,
    reset_circuit_breakers,
)
from app.self_healing.dependency_checker import DependencyChecker
from app.self_healing.failover import FailoverStrategy
from app.self_healing.health_monitor import HealthMonitor, get_health_monitor, reset_health_monitor
from app.self_healing.metrics import HealthMetricsCollector, get_metrics_collector, reset_metrics_collector
from app.self_healing.restart_manager import RestartManager, reset_restart_manager
from app.self_healing.watchdog import Watchdog, reset_watchdog


@pytest.fixture(autouse=True)
def _reset_self_healing():
    reset_circuit_breakers()
    reset_anomaly_monitor()
    reset_metrics_collector()
    reset_health_monitor()
    reset_restart_manager()
    reset_watchdog()
    yield
    reset_circuit_breakers()
    reset_anomaly_monitor()
    reset_metrics_collector()
    reset_health_monitor()
    reset_restart_manager()
    reset_watchdog()


class TestCircuitBreaker:
    def test_initial_state_is_closed(self):
        cb = CircuitBreaker("test", failure_threshold=3)
        assert cb.state == CircuitState.CLOSED
        assert cb.is_available

    def test_opens_after_threshold_failures(self):
        cb = CircuitBreaker("test", failure_threshold=3, reset_timeout=1000)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert not cb.is_available

    def test_success_resets_in_half_open(self):
        cb = CircuitBreaker("test", failure_threshold=1, reset_timeout=0.0)
        cb.record_failure()
        # reset_timeout=0 means it transitions to HALF_OPEN on next state check
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_failure_in_half_open_reopens(self):
        cb = CircuitBreaker("test", failure_threshold=1, reset_timeout=0.0)
        cb.record_failure()
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_failure()
        assert cb._state == CircuitState.OPEN

    def test_stats(self):
        cb = CircuitBreaker("test", failure_threshold=5)
        cb.record_success()
        cb.record_success()
        cb.record_failure()
        stats = cb.get_stats()
        assert stats["name"] == "test"
        assert stats["total_calls"] == 3
        assert stats["total_failures"] == 1

    def test_reset(self):
        cb = CircuitBreaker("test", failure_threshold=2)
        cb.record_failure()
        cb.record_failure()
        assert cb._state == CircuitState.OPEN
        cb.reset()
        assert cb.state == CircuitState.CLOSED

    def test_get_circuit_breaker_singleton(self):
        cb1 = get_circuit_breaker("shared")
        cb2 = get_circuit_breaker("shared")
        assert cb1 is cb2

    def test_rejection_counter(self):
        cb = CircuitBreaker("test", failure_threshold=1, reset_timeout=9999)
        cb.record_failure()
        cb.record_rejection()
        cb.record_rejection()
        assert cb.get_stats()["total_rejections"] == 2


class TestAnomalyMonitor:
    def test_no_anomaly_with_few_samples(self):
        mon = AnomalyMonitor()
        result = mon.observe("cpu", "usage", 50.0)
        assert result is None

    def test_detects_anomaly_on_spike(self):
        mon = AnomalyMonitor(z_threshold=2.0)
        for _ in range(20):
            mon.observe("cpu", "usage", 50.0)
        result = mon.observe("cpu", "usage", 200.0)
        assert result is not None
        assert result.component == "cpu"
        assert result.severity in ("warning", "critical")

    def test_no_anomaly_for_normal_values(self):
        mon = AnomalyMonitor(z_threshold=3.0)
        for i in range(30):
            result = mon.observe("mem", "usage", 50.0 + (i % 3))
        assert result is None

    def test_get_anomalies(self):
        mon = AnomalyMonitor(z_threshold=2.0)
        for _ in range(20):
            mon.observe("test", "metric", 10.0)
        mon.observe("test", "metric", 100.0)
        anomalies = mon.get_anomalies()
        assert len(anomalies) >= 1
        assert anomalies[0]["component"] == "test"

    def test_reset(self):
        mon = AnomalyMonitor()
        for _ in range(10):
            mon.observe("x", "y", 1.0)
        mon.reset()
        assert mon.get_anomalies() == []


class TestMetricsCollector:
    def test_record_and_get_latency(self):
        mc = HealthMetricsCollector()
        mc.record_latency("redis", 5.0)
        mc.record_latency("redis", 10.0)
        mc.record_latency("redis", 15.0)
        assert mc.get_avg_latency("redis") == 10.0

    def test_p95_latency(self):
        mc = HealthMetricsCollector()
        for i in range(100):
            mc.record_latency("db", float(i))
        p95 = mc.get_p95_latency("db")
        assert p95 >= 90.0

    def test_counters_and_gauges(self):
        mc = HealthMetricsCollector()
        mc.increment("requests", 5)
        mc.set_gauge("connections", 42.0)
        metrics = mc.get_all_metrics()
        assert metrics["counters"]["requests"] == 5
        assert metrics["gauges"]["connections"] == 42.0

    def test_system_metrics(self):
        mc = HealthMetricsCollector()
        sys = mc.get_system_metrics()
        assert "cpu_percent" in sys
        assert "memory_rss_mb" in sys

    def test_reset(self):
        mc = HealthMetricsCollector()
        mc.record_latency("x", 1.0)
        mc.increment("y")
        mc.reset()
        assert mc.get_all_metrics()["counters"] == {}

    def test_singleton(self):
        c1 = get_metrics_collector()
        c2 = get_metrics_collector()
        assert c1 is c2


class TestDependencyChecker:
    @pytest.mark.asyncio
    async def test_check_all_returns_dict(self):
        checker = DependencyChecker()
        results = await checker.check_all()
        assert isinstance(results, dict)
        assert "redis" in results
        assert "database" in results
        assert "event_bus" in results
        assert "scheduler" in results
        assert "workflow_engine" in results
        assert "agents" in results

    @pytest.mark.asyncio
    async def test_each_dependency_has_status(self):
        checker = DependencyChecker()
        results = await checker.check_all()
        for name, ds in results.items():
            d = ds.to_dict()
            assert "name" in d
            assert "healthy" in d
            assert "latency_ms" in d


class TestRestartManager:
    @pytest.mark.asyncio
    async def test_can_restart_within_limit(self):
        rm = RestartManager()
        assert rm.can_restart("test_component")

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        rm = RestartManager()
        for _ in range(5):
            rm._restart_history["limited"].append(0.0)
        import time
        rm._restart_history["limited"] = [time.monotonic() for _ in range(5)]
        assert not rm.can_restart("limited")

    @pytest.mark.asyncio
    async def test_restart_unknown_component(self):
        rm = RestartManager()
        result = await rm.restart_component("unknown_xyz")
        assert result["restarted"] is False
        assert result["reason"] == "unknown_component"

    @pytest.mark.asyncio
    async def test_stats(self):
        rm = RestartManager()
        stats = rm.get_stats()
        assert "total_restarts" in stats
        assert "recent_restarts" in stats


class TestFailover:
    @pytest.mark.asyncio
    async def test_redis_failover(self):
        fo = FailoverStrategy()
        result = await fo.failover_redis()
        assert result["component"] == "redis"
        assert result["strategy"] == "in_memory_fallback"

    @pytest.mark.asyncio
    async def test_database_failover(self):
        fo = FailoverStrategy()
        result = await fo.failover_database()
        assert result["component"] == "database"
        assert result["strategy"] == "cached_data_only"

    @pytest.mark.asyncio
    async def test_workflow_failover(self):
        fo = FailoverStrategy()
        result = await fo.failover_workflow("wf-001")
        assert result["strategy"] == "dlq_retry"


class TestHealthMonitor:
    @pytest.mark.asyncio
    async def test_get_system_health(self):
        monitor = HealthMonitor()
        health = await monitor.get_system_health()
        assert "status" in health
        assert health["status"] in ("healthy", "degraded", "unhealthy")
        assert "components" in health

    @pytest.mark.asyncio
    async def test_get_agent_health(self):
        monitor = HealthMonitor()
        health = await monitor.get_agent_health()
        assert "total" in health
        assert "healthy" in health

    @pytest.mark.asyncio
    async def test_get_full_report(self):
        monitor = HealthMonitor()
        report = await monitor.get_full_report()
        assert "system" in report
        assert "agents" in report
        assert "workflows" in report
        assert "metrics" in report
        assert "recovery" in report
        assert "watchdog" in report


class TestWatchdog:
    @pytest.mark.asyncio
    async def test_start_stop(self):
        wd = Watchdog(interval=100)
        assert not wd.is_running
        await wd.start()
        assert wd.is_running
        await wd.stop()
        assert not wd.is_running

    def test_stats(self):
        wd = Watchdog()
        stats = wd.get_stats()
        assert stats["running"] is False
        assert stats["check_count"] == 0
