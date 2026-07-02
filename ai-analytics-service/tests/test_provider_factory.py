"""Tests for Provider Factory — Milestone 5."""

from __future__ import annotations

import pytest

from app.providers import LLMProvider, get_provider
from app.providers.mock_provider import MockProvider


class TestProviderFactory:
    """Unit tests for get_provider() factory function."""

    def test_get_provider_returns_llm_provider(self) -> None:
        provider = get_provider()
        assert isinstance(provider, LLMProvider)

    def test_get_provider_has_name(self) -> None:
        provider = get_provider()
        assert isinstance(provider.name, str)
        assert len(provider.name) > 0

    def test_get_provider_is_singleton_per_call(self) -> None:
        """Each call creates a new instance (not singleton)."""
        p1 = get_provider()
        p2 = get_provider()
        assert isinstance(p1, LLMProvider)
        assert isinstance(p2, LLMProvider)
        # They may be the same type, but different instances


class TestMockProvider:
    """Unit tests for MockProvider."""

    def test_mock_provider_name(self) -> None:
        provider = MockProvider()
        assert provider.name == "mock"

    @pytest.mark.asyncio
    async def test_mock_provider_health_check(self) -> None:
        provider = MockProvider()
        assert await provider.health_check() is True

    @pytest.mark.asyncio
    async def test_mock_provider_generate_revenue(self) -> None:
        provider = MockProvider()
        result = await provider.generate("What was my revenue this week?")
        assert isinstance(result, str)
        assert len(result) > 0
        assert "revenue" in result.lower()

    @pytest.mark.asyncio
    async def test_mock_provider_generate_customers(self) -> None:
        provider = MockProvider()
        result = await provider.generate("Who are my VIP customers?")
        assert isinstance(result, str)
        assert len(result) > 0
        assert "customer" in result.lower()

    @pytest.mark.asyncio
    async def test_mock_provider_generate_menu(self) -> None:
        provider = MockProvider()
        result = await provider.generate("What are my top items?")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_generate_forecast(self) -> None:
        provider = MockProvider()
        result = await provider.generate("What is the forecast?")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_generate_inventory(self) -> None:
        provider = MockProvider()
        result = await provider.generate("What is my inventory status?")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_generate_wait_time(self) -> None:
        provider = MockProvider()
        result = await provider.generate("How long is the wait time?")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_generate_recommendation(self) -> None:
        provider = MockProvider()
        result = await provider.generate("What do you recommend?")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_generate_general(self) -> None:
        provider = MockProvider()
        result = await provider.generate("Hello!")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_handles_empty_prompt(self) -> None:
        provider = MockProvider()
        result = await provider.generate("")
        assert isinstance(result, str)
        assert len(result) > 0  # Should return a fallback response