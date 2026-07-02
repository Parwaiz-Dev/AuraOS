"""Anomaly Monitor — detects abnormal patterns in system metrics."""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Any

logger = logging.getLogger(__name__)

_WINDOW_SIZE = 30


class AnomalyRecord:
    __slots__ = ("component", "metric", "value", "threshold", "severity", "detected_at", "description")

    def __init__(
        self,
        component: str,
        metric: str,
        value: float,
        threshold: float,
        severity: str = "warning",
        description: str = "",
    ) -> None:
        self.component = component
        self.metric = metric
        self.value = value
        self.threshold = threshold
        self.severity = severity
        self.detected_at = time.monotonic()
        self.description = description

    def to_dict(self) -> dict[str, Any]:
        return {
            "component": self.component,
            "metric": self.metric,
            "value": self.value,
            "threshold": self.threshold,
            "severity": self.severity,
            "description": self.description,
        }


class AnomalyMonitor:
    """Statistical anomaly detection using z-score on sliding windows."""

    def __init__(self, z_threshold: float = 2.5) -> None:
        self._z_threshold = z_threshold
        self._windows: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=_WINDOW_SIZE))
        self._anomalies: deque[AnomalyRecord] = deque(maxlen=500)

    def observe(self, component: str, metric: str, value: float) -> AnomalyRecord | None:
        key = f"{component}:{metric}"
        window = self._windows[key]
        window.append(value)

        if len(window) < 5:
            return None

        mean = sum(window) / len(window)
        variance = sum((x - mean) ** 2 for x in window) / len(window)
        std = variance ** 0.5

        if std < 1e-10:
            return None

        z = abs(value - mean) / std
        if z >= self._z_threshold:
            severity = "critical" if z > 4.0 else "warning"
            record = AnomalyRecord(
                component=component,
                metric=metric,
                value=value,
                threshold=mean + self._z_threshold * std,
                severity=severity,
                description=f"z-score={z:.2f} exceeds threshold {self._z_threshold}",
            )
            self._anomalies.appendleft(record)
            logger.warning(
                "Anomaly detected: %s.%s = %.2f (z=%.2f)",
                component, metric, value, z,
            )
            return record
        return None

    def get_anomalies(self, limit: int = 50) -> list[dict[str, Any]]:
        return [a.to_dict() for a in list(self._anomalies)[:limit]]

    def reset(self) -> None:
        self._windows.clear()
        self._anomalies.clear()


_monitor: AnomalyMonitor | None = None


def get_anomaly_monitor() -> AnomalyMonitor:
    global _monitor
    if _monitor is None:
        _monitor = AnomalyMonitor()
    return _monitor


def reset_anomaly_monitor() -> None:
    global _monitor
    _monitor = None
