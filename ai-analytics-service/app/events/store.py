"""Event Store — Redis-backed persistence with in-memory fallback.

Stores events as JSON hashes keyed by event_id. Maintains a sorted set
for chronological ordering and per-restaurant filtered views.
"""

from __future__ import annotations

import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.config.settings import settings
from app.events.event import BaseEvent

logger = logging.getLogger(__name__)

_STORE_KEY = "events:store"
_SORTED_KEY = "events:timeline"
_RESTAURANT_KEY_PREFIX = "events:restaurant:"


class EventStore:
    """Redis-backed event persistence with in-memory deque fallback."""

    def __init__(self) -> None:
        self._memory: deque[dict[str, Any]] = deque(maxlen=5000)

    async def save(self, event: BaseEvent) -> None:
        if not settings.EVENTS_STORE_ENABLED:
            return

        data = event.to_store_dict()
        self._memory.appendleft(data)

        try:
            from app.config.redis_client import get_redis, is_redis_available

            if not await is_redis_available():
                return

            r = await get_redis()
            serialized = json.dumps(data, default=str)
            ts = datetime.now(timezone.utc).timestamp()

            pipe = r.pipeline()
            pipe.hset(_STORE_KEY, event.event_id, serialized)
            pipe.zadd(_SORTED_KEY, {event.event_id: ts})

            if event.restaurant_id:
                rkey = f"{_RESTAURANT_KEY_PREFIX}{event.restaurant_id}"
                pipe.zadd(rkey, {event.event_id: ts})
                pipe.expire(rkey, settings.EVENTS_STORE_TTL_SECONDS)

            pipe.expire(_STORE_KEY, settings.EVENTS_STORE_TTL_SECONDS)
            pipe.expire(_SORTED_KEY, settings.EVENTS_STORE_TTL_SECONDS)
            await pipe.execute()
        except Exception:
            logger.debug("Failed to persist event %s to Redis", event.event_id, exc_info=True)

    async def get(self, event_id: str) -> dict[str, Any] | None:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                raw = await r.hget(_STORE_KEY, event_id)
                if raw:
                    return json.loads(raw)
        except Exception:
            logger.debug("Failed to get event %s from Redis", event_id, exc_info=True)

        for entry in self._memory:
            if entry.get("event_id") == event_id:
                return entry
        return None

    async def query(
        self,
        *,
        event_type: str | None = None,
        restaurant_id: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        entries = await self._get_all_entries(restaurant_id=restaurant_id)

        if event_type:
            entries = [e for e in entries if e.get("event_name") == event_type]

        if status:
            entries = [e for e in entries if e.get("status") == status]

        if start_date:
            entries = [e for e in entries if (e.get("timestamp", "") >= start_date)]

        if end_date:
            entries = [e for e in entries if (e.get("timestamp", "") <= end_date)]

        total = len(entries)
        start = (page - 1) * page_size
        end = start + page_size
        items = entries[start:end]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
        }

    async def get_stats(self) -> dict[str, Any]:
        entries = await self._get_all_entries()

        total = len(entries)
        processed = sum(1 for e in entries if e.get("status", "").startswith("processed"))
        failed = sum(1 for e in entries if e.get("status") == "failed")
        pending = sum(1 for e in entries if e.get("status") == "pending")
        retries = sum(int(e.get("retry_count", 0)) for e in entries)

        event_types: dict[str, int] = {}
        for e in entries:
            name = e.get("event_name", "unknown")
            event_types[name] = event_types.get(name, 0) + 1

        from app.events.event_bus import get_event_bus

        bus = get_event_bus()
        bus_stats = bus.stats
        avg_time = 0.0
        if int(bus_stats.get("total_processed", 0)) > 0:
            avg_time = float(bus_stats["total_processing_time_ms"]) / int(bus_stats["total_processed"])

        return {
            "total_events": total,
            "processed": processed,
            "failed": failed,
            "pending": pending,
            "retries": retries,
            "average_processing_time_ms": round(avg_time, 2),
            "throughput_per_minute": round(
                int(bus_stats.get("total_processed", 0)) / max(1, total) * 60, 2
            ),
            "event_types": event_types,
        }

    async def _get_all_entries(
        self,
        *,
        restaurant_id: str | None = None,
    ) -> list[dict[str, Any]]:
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()

                if restaurant_id:
                    rkey = f"{_RESTAURANT_KEY_PREFIX}{restaurant_id}"
                    event_ids = await r.zrevrange(rkey, 0, -1)
                else:
                    event_ids = await r.zrevrange(_SORTED_KEY, 0, -1)

                if event_ids:
                    raws = await r.hmget(_STORE_KEY, *event_ids)
                    return [json.loads(r) for r in raws if r is not None]
        except Exception:
            logger.debug("Failed to query events from Redis", exc_info=True)

        entries = list(self._memory)
        if restaurant_id:
            entries = [e for e in entries if e.get("restaurant_id") == restaurant_id]
        return entries

    async def clear(self) -> int:
        count = len(self._memory)
        self._memory.clear()
        try:
            from app.config.redis_client import get_redis, is_redis_available

            if await is_redis_available():
                r = await get_redis()
                await r.delete(_STORE_KEY, _SORTED_KEY)
        except Exception:
            logger.debug("Failed to clear event store in Redis", exc_info=True)
        return count


_store: EventStore | None = None


def get_event_store() -> EventStore:
    global _store
    if _store is None:
        _store = EventStore()
    return _store


def reset_event_store() -> None:
    global _store
    _store = None
