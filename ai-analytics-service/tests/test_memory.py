"""Tests for Conversation Memory — Milestone 5."""

from __future__ import annotations

import pytest

from app.copilot.conversation_memory import ConversationMemory, get_memory


@pytest.mark.asyncio
class TestConversationMemory:
    """Unit tests for ConversationMemory."""

    def test_init_sets_restaurant_id(self) -> None:
        memory = ConversationMemory("rest-123")
        assert memory._restaurant_id == "rest-123"

    def test_cache_key_includes_restaurant_id(self) -> None:
        memory = ConversationMemory("rest-456")
        assert "rest-456" in memory.cache_key
        assert memory.cache_key.startswith("copilot:memory:")

    def test_max_history_from_settings(self) -> None:
        memory = ConversationMemory("rest-123")
        assert isinstance(memory.max_history, int)
        assert memory.max_history > 0

    def test_ttl_from_settings(self) -> None:
        memory = ConversationMemory("rest-123")
        assert isinstance(memory.ttl, int)
        assert memory.ttl > 0

    def test_exchange_count_starts_zero(self) -> None:
        memory = ConversationMemory("rest-123")
        assert memory.exchange_count == 0

    def test_get_formatted_history_empty(self) -> None:
        memory = ConversationMemory("rest-123")
        result = memory.get_formatted_history()
        assert "No prior conversation" in result

    async def test_add_exchange_increments_count(self) -> None:
        memory = ConversationMemory("rest-123")
        # Don't persist to Redis (unit test without Redis)
        await memory.add_exchange("user", "Hello")
        assert memory.exchange_count == 1

    async def test_add_exchange_trims_to_max(self) -> None:
        memory = ConversationMemory("rest-123")
        # Add more than max_history exchanges
        for i in range(memory.max_history + 5):
            await memory.add_exchange("user", f"Message {i}")
        assert memory.exchange_count <= memory.max_history

    async def test_get_history_returns_copy(self) -> None:
        memory = ConversationMemory("rest-123")
        await memory.add_exchange("user", "Hello")
        history = await memory.get_history()
        assert len(history) == 1
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello"

    async def test_get_formatted_history_with_exchanges(self) -> None:
        memory = ConversationMemory("rest-123")
        await memory.add_exchange("user", "What is my revenue?")
        await memory.add_exchange("assistant", "Your revenue is...")
        formatted = memory.get_formatted_history()
        assert "User:" in formatted
        assert "Assistant:" in formatted
        assert "What is my revenue?" in formatted

    async def test_clear_empties_history(self) -> None:
        memory = ConversationMemory("rest-123")
        await memory.add_exchange("user", "Hello")
        await memory.clear()
        assert memory.exchange_count == 0

    async def test_add_exchange_has_timestamp(self) -> None:
        memory = ConversationMemory("rest-123")
        await memory.add_exchange("user", "Hello")
        history = await memory.get_history()
        assert "timestamp" in history[0]
        assert isinstance(history[0]["timestamp"], float)


class TestGetMemory:
    """Unit tests for get_memory() factory function."""

    @pytest.mark.asyncio
    async def test_get_memory_returns_conversation_memory(self) -> None:
        memory = await get_memory("rest-789")
        assert isinstance(memory, ConversationMemory)
        assert memory._restaurant_id == "rest-789"

    @pytest.mark.asyncio
    async def test_different_restaurants_have_different_keys(self) -> None:
        m1 = await get_memory("rest-a")
        m2 = await get_memory("rest-b")
        assert m1.cache_key != m2.cache_key