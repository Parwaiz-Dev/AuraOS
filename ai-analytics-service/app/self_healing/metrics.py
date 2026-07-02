"""Health Metrics Collector — tracks CPU, memory, latencies, queue lengths."""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Any

logger = logging.getLogger(__name__)

_WINDOW = 100


class HealthMetricsCollector:
    """Collects and aggregates system and component health metrics."""

    def __init__(self) -> None:
        self._latencies: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=_WINDOW))
        self._counters: dict[str, int] = defaultdict(int)
        self._gauges: dict[str, float] = defaultdict(float)
        self._start_time = time.monotonic()

    def record_latency(self, component: str, latency_ms: float) -> None:
        self._latencies[component].append(latency_ms)

    def increment(self, name: str, amount: int = 1) -> None:
        self._counters[name] += amount

    def set_gauge(self, name: str, value: float) -> None:
        self._gauges[name] = value

    def get_avg_latency(self, component: str) -> float:
        samples = self._latencies.get(component)
        if not samples:
            return 0.0
        return round(sum(samples) / len(samples), 2)

    def get_p95_latency(self, component: str) -> float:
        samples = self._latencies.get(component)
        if not samples:
            return 0.0
        sorted_samples = sorted(samples)
        idx = int(len(sorted_samples) * 0.95)
        return round(sorted_samples[min(idx, len(sorted_samples) - 1)], 2)

    def get_system_metrics(self) -> dict[str, Any]:
        try:
            import os
            import psutil
            proc = psutil.Process(os.getpid())
            cpu = proc.cpu_percent(interval=None)
            mem = proc.memory_info()
            return {
                "cpu_percent": cpu,
                "memory_rss_mb": round(mem.rss / 1024 / 1024, 2),
                "memory_vms_mb": round(mem.vms / 1024 / 1024, 2),
                "threads": proc.num_threads(),
            }
        except Exception:
            return {
                "cpu_percent": 0.0,
                "memory_rss_mb": 0.0,
                "memory_vms_mb": 0.0,
                "threads": 0,
            }

    def get_all_metrics(self) -> dict[str, Any]:
        latency_summary: dict[str, Any] = {}
        for comp, samples in self._latencies.items():
            if samples:
                latency_summary[comp] = {
                    "avg_ms": self.get_avg_latency(comp),
                    "p95_ms": self.get_p95_latency(comp),
                    "samples": len(samples),
                }

        return {
            "uptime_seconds": round(time.monotonic() - self._start_time, 2),
            "system": self.get_system_metrics(),
            "latencies": latency_summary,
            "counters": dict(self._counters),
            "gauges": dict(self._gauges),
        }

    def reset(self) -> None:
        self._latencies.clear()
        self._counters.clear()
        self._gauges.clear()
        self._start_time = time.monotonic()


_collector: HealthMetricsCollector | None = None


def get_metrics_collector() -> HealthMetricsCollector:
    global _collector
    if _collector is None:
        _collector = HealthMetricsCollector()
    return _collector


def reset_metrics_collector() -> None:
    global _collector
    _collector = None
