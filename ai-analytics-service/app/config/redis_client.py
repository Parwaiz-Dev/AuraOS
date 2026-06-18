"""
Redis client for caching and Celery broker connectivity.

Provides a simple async wrapper around the synchronous redis-py client.
In production this is fine because FastAPI runs in a thread pool for
synchronous I/O.  For high-throughput scenarios, consider redis.asyncio.
"""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config.settings import settings

# ── Pool ────────────────────────────────────────────────────────────────────────

_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return a connected Redis client, creating the pool on first call."""
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _pool


async def close_redis() -> None:
    """Close the Redis pool (called on shutdown)."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


# ── Cache helpers ───────────────────────────────────────────────────────────────


async def cache_get(key: str) -> Any | None:
    """Get a cached value, returning None on miss or error."""
    try:
        r = await get_redis()
        raw = await r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    """Set a cache key with optional TTL (seconds)."""
    try:
        r = await get_redis()
        ttl = ttl or settings.CACHE_TTL_SECONDS
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass  # cache is best-effort


async def cache_delete(key: str) -> None:
    """Delete a cache key."""
    try:
        r = await get_redis()
        await r.delete(key)
    except Exception:
        pass


async def is_redis_available() -> bool:
    """Return True if Redis is reachable."""
    try:
        r = await get_redis()
        await r.ping()
        return True
    except Exception:
        return False