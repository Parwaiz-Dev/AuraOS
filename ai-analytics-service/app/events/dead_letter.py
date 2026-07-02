"""Dead Letter Queue — stores permanently failed events for manual replay."""

from __future__ import annotations

import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.config.settings import settings
from app.events.event import BaseEvent

logger = logging.getLogger(__name__)

_DLQ_KEY = "events:dlq"


class DeadLetterEntry:
    """A failed event with retry metadata."""

    __slots__ = ("event_data", "handler_name", "failed_at", "retry_count")

    def __init__(
        self,
        event_data: dict[str, Any],
        handler_name: str,
        failed_at: str,
        retry_count: int,
    ) -> None:
        self.event_data = event_data
        self.handler_name = handler_name
        self.failed_at = failed_at
        self.retry_count = retry_count

    def to_dict(self) -> dict[str, Any]:
        return {
            "event": self.event_data,
            "handler_name": self.handler_name,
            "failed_at": self.failed_at,
            "retry_count": self.retry_count,
        }


class DeadLetterQueue:
    """Redis-backed DLQ with in-memory fallback."""

    def __init__(self) -> None:
        self._memory: deque[dict[str, Any]] = deque(maxlen=settings.EVENTS_DLQ_MAX_SIZE)

    async def add(self, event: BaseEvent, handler_name: str) -> None:
        entry = DeadLetterEntry(
            event_data=event.to_store_dict(),
            handler_name=handler_name,
            failed_at=datetime.now(timezone.utc).isoformat(),
            retry_count=event.retry_count,
        )
        data = entry.to_dict()
        self._memory.appendleft(data)

        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                await r.lpush(_DLQ_KEY, json.dumps(data, default=str))
                await r.ltrim(_DLQ_KEY, 0, settings.EVENTS_DLQ_MAX_SIZE - 1)
        except Exception:
            logger.debug("Failed to add event to DLQ in Redis", exc_info=True)

        logger.warning(
            "Event %s (handler=%s) moved to dead-letter queue after %d retries",
            event.event_id, handler_name, event.retry_count,
        )

    async def get_all(self, limit: int = 100) -> list[dict[str, Any]]:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                raws = await r.lrange(_DLQ_KEY, 0, limit - 1)
                if raws:
                    return [json.loads(raw) for raw in raws]
        except Exception:
            logger.debug("Failed to read DLQ from Redis", exc_info=True)

        return list(self._memory)[:limit]

    async def get_count(self) -> int:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                return await r.llen(_DLQ_KEY)
        except Exception:
            pass
        return len(self._memory)

    async def replay_all(self) -> int:
        """Re-publish all DLQ entries through the event bus. Returns count replayed."""
        entries = await self.get_all(limit=settings.EVENTS_DLQ_MAX_SIZE)
        if not entries:
            return 0

        from app.events.domain_events import ALL_EVENT_TYPES
        from app.events.publisher import publish

        replayed = 0
        for entry in entries:
            event_data = entry.get("event", {})
            event_name = event_data.get("event_name", "")
            event_cls = ALL_EVENT_TYPES.get(event_name, BaseEvent)

            try:
                event = event_cls.model_validate(event_data)
                event.retry_count = 0
                event.status = "replaying"
                await publish(event)
                replayed += 1
            except Exception:
                logger.warning("Failed to replay DLQ event %s", event_data.get("event_id"), exc_info=True)

        await self.clear()
        logger.info("Replayed %d events from DLQ", replayed)
        return replayed

    async def clear(self) -> int:
        count = len(self._memory)
        self._memory.clear()
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                await r.delete(_DLQ_KEY)
        except Exception:
            logger.debug("Failed to clear DLQ in Redis", exc_info=True)
        return count

    async def get_stats(self) -> dict[str, Any]:
        count = await self.get_count()
        entries = await self.get_all(limit=count or 100)

        handler_counts: dict[str, int] = {}
        event_type_counts: dict[str, int] = {}
        for entry in entries:
            handler = entry.get("handler_name", "unknown")
            handler_counts[handler] = handler_counts.get(handler, 0) + 1
            event_name = entry.get("event", {}).get("event_name", "unknown")
            event_type_counts[event_name] = event_type_counts.get(event_name, 0) + 1

        return {
            "total_failed": count,
            "by_handler": handler_counts,
            "by_event_type": event_type_counts,
        }


_dlq: DeadLetterQueue | None = None


def get_dlq() -> DeadLetterQueue:
    global _dlq
    if _dlq is None:
        _dlq = DeadLetterQueue()
    return _dlq


def reset_dlq() -> None:
    global _dlq
    _dlq = None
