"""Agent Memory — short-term, long-term, and shared context (Redis-backed)."""

from __future__ import annotations

import json
import logging
from collections import defaultdict, deque
from typing import Any

logger = logging.getLogger(__name__)

_SHORT_TERM: dict[str, deque[dict[str, Any]]] = defaultdict(lambda: deque(maxlen=50))
_LONG_TERM: dict[str, dict[str, Any]] = defaultdict(dict)
_SHARED: dict[str, dict[str, Any]] = defaultdict(dict)

_ST_PREFIX = "agents:memory:st:"
_LT_PREFIX = "agents:memory:lt:"
_SHARED_PREFIX = "agents:memory:shared:"


async def store_short_term(agent_id: str, key: str, value: Any) -> None:
    _SHORT_TERM[agent_id].appendleft({"key": key, "value": value})
    try:
        from app.config.redis_client import get_redis, is_redis_available
        if await is_redis_available():
            r = await get_redis()
            await r.lpush(f"{_ST_PREFIX}{agent_id}", json.dumps({"key": key, "value": value}, default=str))
            await r.ltrim(f"{_ST_PREFIX}{agent_id}", 0, 49)
    except Exception:
        pass


async def get_short_term(agent_id: str, limit: int = 10) -> list[dict[str, Any]]:
    try:
        from app.config.redis_client import get_redis, is_redis_available
        if await is_redis_available():
            r = await get_redis()
            raws = await r.lrange(f"{_ST_PREFIX}{agent_id}", 0, limit - 1)
            if raws:
                return [json.loads(raw) for raw in raws]
    except Exception:
        pass
    return list(_SHORT_TERM[agent_id])[:limit]


async def store_long_term(agent_id: str, key: str, value: Any) -> None:
    _LONG_TERM[agent_id][key] = value
    try:
        from app.config.redis_client import get_redis, is_redis_available
        if await is_redis_available():
            r = await get_redis()
            await r.hset(f"{_LT_PREFIX}{agent_id}", key, json.dumps(value, default=str))
    except Exception:
        pass


async def get_long_term(agent_id: str, key: str) -> Any:
    try:
        from app.config.redis_client import get_redis, is_redis_available
        if await is_redis_available():
            r = await get_redis()
            raw = await r.hget(f"{_LT_PREFIX}{agent_id}", key)
            if raw:
                return json.loads(raw)
    except Exception:
        pass
    return _LONG_TERM.get(agent_id, {}).get(key)


async def store_shared(restaurant_id: str, key: str, value: Any) -> None:
    _SHARED[restaurant_id][key] = value
    try:
        from app.config.redis_client import get_redis, is_redis_available
        if await is_redis_available():
            r = await get_redis()
            await r.hset(f"{_SHARED_PREFIX}{restaurant_id}", key, json.dumps(value, default=str))
    except Exception:
        pass


async def get_shared(restaurant_id: str, key: str) -> Any:
    try:
        from app.config.redis_client import get_redis, is_redis_available
        if await is_redis_available():
            r = await get_redis()
            raw = await r.hget(f"{_SHARED_PREFIX}{restaurant_id}", key)
            if raw:
                return json.loads(raw)
    except Exception:
        pass
    return _SHARED.get(restaurant_id, {}).get(key)


def reset_memory() -> None:
    _SHORT_TERM.clear()
    _LONG_TERM.clear()
    _SHARED.clear()
