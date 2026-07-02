"""Graph Memory — conversation, agent, workflow, and restaurant memory (Redis-backed)."""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

_CONV_PREFIX = "graph:memory:conv:"
_AGENT_PREFIX = "graph:memory:agent:"
_WF_PREFIX = "graph:memory:wf:"
_CTX_PREFIX = "graph:memory:ctx:"
_EXEC_PREFIX = "graph:memory:exec:"


class GraphMemory:
    """Multi-layer memory system for graph execution."""

    def __init__(self) -> None:
        self._conversation: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._agent_memory: dict[str, dict[str, Any]] = defaultdict(dict)
        self._workflow_memory: dict[str, dict[str, Any]] = defaultdict(dict)
        self._context: dict[str, dict[str, Any]] = defaultdict(dict)
        self._execution_history: dict[str, list[dict[str, Any]]] = defaultdict(list)

    # ── Conversation Memory ─────────────────────────────────────────────────

    async def add_conversation(
        self, restaurant_id: str, role: str, content: str,
    ) -> None:
        entry = {"role": role, "content": content}
        self._conversation[restaurant_id].append(entry)
        self._conversation[restaurant_id] = self._conversation[restaurant_id][-50:]
        await self._redis_lpush(f"{_CONV_PREFIX}{restaurant_id}", entry)

    async def get_conversation(
        self, restaurant_id: str, limit: int = 20,
    ) -> list[dict[str, Any]]:
        cached = await self._redis_lrange(f"{_CONV_PREFIX}{restaurant_id}", limit)
        if cached:
            return cached
        return self._conversation[restaurant_id][-limit:]

    # ── Agent Memory ────────────────────────────────────────────────────────

    async def save_agent_state(
        self, agent_id: str, state: dict[str, Any],
    ) -> None:
        self._agent_memory[agent_id] = state
        await self._redis_hset(_AGENT_PREFIX + agent_id, state)

    async def load_agent_state(self, agent_id: str) -> dict[str, Any]:
        cached = await self._redis_hgetall(_AGENT_PREFIX + agent_id)
        if cached:
            return cached
        return dict(self._agent_memory.get(agent_id, {}))

    # ── Workflow Memory ─────────────────────────────────────────────────────

    async def save_workflow_state(
        self, workflow_id: str, state: dict[str, Any],
    ) -> None:
        self._workflow_memory[workflow_id] = state
        await self._redis_hset(_WF_PREFIX + workflow_id, state)

    async def load_workflow_state(self, workflow_id: str) -> dict[str, Any]:
        cached = await self._redis_hgetall(_WF_PREFIX + workflow_id)
        if cached:
            return cached
        return dict(self._workflow_memory.get(workflow_id, {}))

    # ── Context Memory (restaurant-scoped) ──────────────────────────────────

    async def save_context(
        self, restaurant_id: str, graph_id: str, context: dict[str, Any],
    ) -> None:
        key = f"{restaurant_id}:{graph_id}"
        serializable = {}
        for k, v in context.items():
            if not k.startswith("_"):
                try:
                    json.dumps(v, default=str)
                    serializable[k] = v
                except (TypeError, ValueError):
                    pass
        self._context[key] = serializable
        await self._redis_hset(f"{_CTX_PREFIX}{key}", serializable)

    async def load_context(
        self, restaurant_id: str, graph_id: str,
    ) -> dict[str, Any]:
        key = f"{restaurant_id}:{graph_id}"
        cached = await self._redis_hgetall(f"{_CTX_PREFIX}{key}")
        if cached:
            return cached
        return dict(self._context.get(key, {}))

    # ── Execution History ───────────────────────────────────────────────────

    async def record_execution(
        self, restaurant_id: str, execution: dict[str, Any],
    ) -> None:
        self._execution_history[restaurant_id].append(execution)
        self._execution_history[restaurant_id] = self._execution_history[restaurant_id][-100:]
        await self._redis_lpush(f"{_EXEC_PREFIX}{restaurant_id}", execution)

    async def get_execution_history(
        self, restaurant_id: str, limit: int = 20,
    ) -> list[dict[str, Any]]:
        cached = await self._redis_lrange(f"{_EXEC_PREFIX}{restaurant_id}", limit)
        if cached:
            return cached
        return self._execution_history[restaurant_id][-limit:]

    # ── Redis helpers ───────────────────────────────────────────────────────

    async def _redis_lpush(self, key: str, value: Any) -> None:
        try:
            from app.config.redis_client import get_redis, is_redis_available
            if await is_redis_available():
                r = await get_redis()
                await r.lpush(key, json.dumps(value, default=str))
                await r.ltrim(key, 0, 99)
        except Exception:
            pass

    async def _redis_lrange(self, key: str, limit: int) -> list[dict[str, Any]]:
        try:
            from app.config.redis_client import get_redis, is_redis_available
            if await is_redis_available():
                r = await get_redis()
                raws = await r.lrange(key, 0, limit - 1)
                if raws:
                    return [json.loads(raw) for raw in raws]
        except Exception:
            pass
        return []

    async def _redis_hset(self, key: str, mapping: dict[str, Any]) -> None:
        try:
            from app.config.redis_client import get_redis, is_redis_available
            if await is_redis_available():
                r = await get_redis()
                serialized = {
                    k: json.dumps(v, default=str)
                    for k, v in mapping.items()
                    if not k.startswith("_")
                }
                if serialized:
                    await r.hset(key, mapping=serialized)
                    await r.expire(key, 86400)
        except Exception:
            pass

    async def _redis_hgetall(self, key: str) -> dict[str, Any]:
        try:
            from app.config.redis_client import get_redis, is_redis_available
            if await is_redis_available():
                r = await get_redis()
                raw = await r.hgetall(key)
                if raw:
                    result = {}
                    for k, v in raw.items():
                        try:
                            result[k] = json.loads(v)
                        except (json.JSONDecodeError, TypeError):
                            result[k] = v
                    return result
        except Exception:
            pass
        return {}

    def reset(self) -> None:
        self._conversation.clear()
        self._agent_memory.clear()
        self._workflow_memory.clear()
        self._context.clear()
        self._execution_history.clear()


_memory: GraphMemory | None = None


def get_graph_memory() -> GraphMemory:
    global _memory
    if _memory is None:
        _memory = GraphMemory()
    return _memory


def reset_graph_memory() -> None:
    global _memory
    _memory = None
