"""Conversation Memory — Redis-backed per-restaurant conversation history.

Stores the last N exchanges per restaurant with a configurable TTL.
Uses Redis hashes for efficient storage and retrieval.
"""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, cache_delete, is_redis_available
from app.config.settings import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class ConversationMemory:
    """Stores the last N conversation exchanges for a restaurant.

    Each exchange is a dict: {"role": "user"|"assistant", "content": "...", "timestamp": float}
    """

    def __init__(self, restaurant_id: str) -> None:
        self._restaurant_id = restaurant_id
        self._history: list[dict[str, str | float]] = []

    @property
    def cache_key(self) -> str:
        return f"copilot:memory:{self._restaurant_id}"

    @property
    def max_history(self) -> int:
        return settings.COPILOT_MAX_HISTORY

    @property
    def ttl(self) -> int:
        return settings.COPILOT_MEMORY_TTL

    async def load(self) -> None:
        """Load conversation history from Redis."""
        raw = await cache_get(self.cache_key)
        if raw is not None and isinstance(raw, list):
            self._history = raw[-self.max_history :]
            logger.debug("Loaded %d exchanges for %s", len(self._history), self._restaurant_id)
        else:
            self._history = []

    async def add_exchange(self, role: str, content: str) -> None:
        """Add a new exchange and persist to Redis."""
        exchange = {
            "role": role,
            "content": content,
            "timestamp": time.time(),
        }
        self._history.append(exchange)

        # Trim to max history
        if len(self._history) > self.max_history:
            self._history = self._history[-self.max_history :]

        # Persist to Redis
        await cache_set(self.cache_key, self._history, ttl=self.ttl)

    async def get_history(self) -> list[dict[str, str | float]]:
        """Return the conversation history as a list of exchanges."""
        return list(self._history)

    def get_formatted_history(self) -> str:
        """Return the conversation history formatted as a string for prompts."""
        if not self._history:
            return "No prior conversation."

        lines: list[str] = []
        for ex in self._history:
            role = str(ex["role"]).capitalize()
            content = str(ex["content"])
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    async def clear(self) -> None:
        """Clear the conversation history."""
        self._history = []
        await cache_delete(self.cache_key)

    @property
    def exchange_count(self) -> int:
        return len(self._history)


async def get_memory(restaurant_id: str) -> ConversationMemory:
    """Factory: create and load a ConversationMemory for the given restaurant."""
    memory = ConversationMemory(restaurant_id)
    await memory.load()
    return memory