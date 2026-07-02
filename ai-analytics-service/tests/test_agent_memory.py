"""Tests for Agent Memory — short-term, long-term, and shared context."""

from __future__ import annotations

import pytest

from app.agents.memory import (
    get_long_term,
    get_shared,
    get_short_term,
    reset_memory,
    store_long_term,
    store_shared,
    store_short_term,
)


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_memory()


@pytest.mark.asyncio
class TestShortTermMemory:
    async def test_store_and_retrieve(self) -> None:
        await store_short_term("agent_1", "last_action", "forecast")
        results = await get_short_term("agent_1")
        assert len(results) >= 1
        assert results[0]["key"] == "last_action"
        assert results[0]["value"] == "forecast"

    async def test_limit(self) -> None:
        for i in range(5):
            await store_short_term("agent_1", f"key_{i}", f"val_{i}")
        results = await get_short_term("agent_1", limit=3)
        assert len(results) == 3

    async def test_isolation_between_agents(self) -> None:
        await store_short_term("agent_1", "k1", "v1")
        await store_short_term("agent_2", "k2", "v2")
        r1 = await get_short_term("agent_1")
        r2 = await get_short_term("agent_2")
        assert r1[0]["key"] == "k1"
        assert r2[0]["key"] == "k2"


@pytest.mark.asyncio
class TestLongTermMemory:
    async def test_store_and_retrieve(self) -> None:
        await store_long_term("agent_1", "model_version", "v3")
        result = await get_long_term("agent_1", "model_version")
        assert result == "v3"

    async def test_missing_key(self) -> None:
        result = await get_long_term("agent_1", "nonexistent")
        assert result is None

    async def test_overwrite(self) -> None:
        await store_long_term("agent_1", "key", "old")
        await store_long_term("agent_1", "key", "new")
        result = await get_long_term("agent_1", "key")
        assert result == "new"


@pytest.mark.asyncio
class TestSharedMemory:
    async def test_store_and_retrieve(self) -> None:
        await store_shared("r1", "daily_revenue", 5000.0)
        result = await get_shared("r1", "daily_revenue")
        assert result == 5000.0

    async def test_isolation_between_restaurants(self) -> None:
        await store_shared("r1", "key", "val_r1")
        await store_shared("r2", "key", "val_r2")
        assert await get_shared("r1", "key") == "val_r1"
        assert await get_shared("r2", "key") == "val_r2"

    async def test_missing_key(self) -> None:
        result = await get_shared("r1", "nonexistent")
        assert result is None
