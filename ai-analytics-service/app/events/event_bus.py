"""Async event bus — publish, subscribe, retry, error isolation.

The bus is an in-process singleton.  Every ``publish()`` call:
1. Persists the event to the store (Redis, best-effort)
2. Dispatches to all registered handlers concurrently
3. Retries failed handlers with exponential back-off
4. Moves permanently-failed events to the dead-letter queue

Handler errors never propagate to the publisher.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.config.settings import settings
from app.events.event import BaseEvent
from app.events.registry import HandlerFunc, get_registry

logger = logging.getLogger(__name__)


class EventBus:
    """Core async event bus with retry and error isolation."""

    def __init__(self) -> None:
        self._running = False
        self._stats: dict[str, int | float] = {
            "total_published": 0,
            "total_processed": 0,
            "total_failed": 0,
            "total_retries": 0,
            "total_processing_time_ms": 0.0,
        }

    async def start(self) -> None:
        self._running = True
        logger.info("EventBus started")

    async def stop(self) -> None:
        self._running = False
        logger.info("EventBus stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def stats(self) -> dict[str, int | float]:
        return dict(self._stats)

    async def publish(self, event: BaseEvent) -> None:
        """Fire-and-forget: persist + dispatch to all handlers concurrently."""
        if not settings.EVENTS_ENABLED:
            return

        self._stats["total_published"] = int(self._stats["total_published"]) + 1

        # Persist to store (best-effort)
        await self._persist(event)

        # Dispatch to handlers
        registry = get_registry()
        handlers = registry.get_handlers(event.event_name)

        if not handlers:
            logger.debug("No handlers for event %s", event.event_name)
            event.status = "processed"
            event.processed_at = _now_iso()
            await self._persist(event)
            return

        tasks = [
            self._execute_handler(handler, event)
            for handler in handlers
        ]
        await asyncio.gather(*tasks)

    async def publish_and_collect(self, event: BaseEvent) -> list[Any]:
        """Publish and collect results from all handlers (request-reply)."""
        if not settings.EVENTS_ENABLED:
            return []

        self._stats["total_published"] = int(self._stats["total_published"]) + 1
        await self._persist(event)

        registry = get_registry()
        handlers = registry.get_handlers(event.event_name)

        if not handlers:
            event.status = "processed"
            event.processed_at = _now_iso()
            await self._persist(event)
            return []

        tasks = [
            self._execute_handler(handler, event, collect=True)
            for handler in handlers
        ]
        results = await asyncio.gather(*tasks)
        return [r for r in results if r is not None]

    async def _execute_handler(
        self,
        handler: HandlerFunc,
        event: BaseEvent,
        *,
        collect: bool = False,
    ) -> Any:
        """Run a single handler with retry and error isolation."""
        max_retries = settings.EVENTS_MAX_RETRIES
        base_delay = settings.EVENTS_RETRY_DELAY_SECONDS
        handler_name = handler.__qualname__

        t0 = time.monotonic()

        for attempt in range(max_retries + 1):
            try:
                result = await handler(event)

                elapsed = (time.monotonic() - t0) * 1000
                self._stats["total_processed"] = int(self._stats["total_processed"]) + 1
                self._stats["total_processing_time_ms"] = (
                    float(self._stats["total_processing_time_ms"]) + elapsed
                )

                if attempt == 0:
                    event.status = "processed"
                else:
                    event.status = "processed_after_retry"
                event.processed_at = _now_iso()
                await self._persist(event)

                logger.debug(
                    "Handler %s processed %s in %.1fms",
                    handler_name, event.event_name, elapsed,
                )
                return result if collect else None

            except Exception:
                event.retry_count = attempt + 1
                self._stats["total_retries"] = int(self._stats["total_retries"]) + 1

                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        "Handler %s failed for %s (attempt %d/%d), retrying in %.1fs",
                        handler_name, event.event_name, attempt + 1, max_retries + 1, delay,
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        "Handler %s permanently failed for %s after %d attempts",
                        handler_name, event.event_name, max_retries + 1,
                        exc_info=True,
                    )
                    self._stats["total_failed"] = int(self._stats["total_failed"]) + 1
                    event.status = "failed"
                    await self._persist(event)
                    await self._send_to_dlq(event, handler_name)

        return None

    async def _persist(self, event: BaseEvent) -> None:
        """Best-effort persist to the event store."""
        try:
            from app.events.store import get_event_store

            store = get_event_store()
            await store.save(event)
        except Exception:
            logger.debug("Failed to persist event %s", event.event_id, exc_info=True)

    async def _send_to_dlq(self, event: BaseEvent, handler_name: str) -> None:
        """Send a permanently failed event to the dead-letter queue."""
        try:
            from app.events.dead_letter import get_dlq

            dlq = get_dlq()
            await dlq.add(event, handler_name)
        except Exception:
            logger.debug("Failed to add event %s to DLQ", event.event_id, exc_info=True)

    def reset_stats(self) -> None:
        for key in self._stats:
            self._stats[key] = 0


# ── Singleton ────────────────────────────────────────────────────────────────

_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        _bus = EventBus()
    return _bus


def reset_event_bus() -> None:
    global _bus
    if _bus is not None:
        _bus.reset_stats()
    _bus = None


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
