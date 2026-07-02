"""Watchdog — periodic background health check loop."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class Watchdog:
    """Periodically checks component health and triggers recovery actions."""

    def __init__(self, interval: float = 30.0) -> None:
        self.interval = interval
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._last_check: float = 0.0
        self._check_count = 0
        self._issues_found = 0
        self._recoveries_triggered = 0

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Watchdog started (interval=%.0fs)", self.interval)

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Watchdog stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._check()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.debug("Watchdog check error", exc_info=True)
            await asyncio.sleep(self.interval)

    async def _check(self) -> None:
        self._last_check = time.monotonic()
        self._check_count += 1

        from app.self_healing.dependency_checker import get_dependency_checker
        checker = get_dependency_checker()
        results = await checker.check_all()

        unhealthy = [name for name, ds in results.items() if not ds.healthy]
        if unhealthy:
            self._issues_found += len(unhealthy)
            logger.warning("Watchdog detected unhealthy: %s", unhealthy)

            from app.self_healing.recovery_engine import get_recovery_engine
            engine = get_recovery_engine()
            for component in unhealthy:
                try:
                    await engine.recover(component)
                    self._recoveries_triggered += 1
                except Exception:
                    logger.debug("Watchdog recovery failed for %s", component, exc_info=True)

        from app.self_healing.metrics import get_metrics_collector
        collector = get_metrics_collector()
        for name, ds in results.items():
            collector.record_latency(name, ds.latency_ms)
            collector.set_gauge(f"{name}_healthy", 1.0 if ds.healthy else 0.0)

    def get_stats(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "interval": self.interval,
            "check_count": self._check_count,
            "issues_found": self._issues_found,
            "recoveries_triggered": self._recoveries_triggered,
        }


_watchdog: Watchdog | None = None


def get_watchdog() -> Watchdog:
    global _watchdog
    if _watchdog is None:
        _watchdog = Watchdog()
    return _watchdog


def reset_watchdog() -> None:
    global _watchdog
    _watchdog = None
