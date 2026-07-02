"""Tests for the EventBus — publish, subscribe, retry, error isolation."""

from __future__ import annotations

import asyncio

import pytest

from app.events.domain_events import InsightGenerated, OrderCompleted
from app.events.event import BaseEvent
from app.events.event_bus import get_event_bus, reset_event_bus
from app.events.registry import get_registry, reset_registry


@pytest.fixture(autouse=True)
def _clean_bus() -> None:
    reset_event_bus()
    reset_registry()


@pytest.mark.asyncio
class TestEventBusPublish:
    async def test_publish_calls_handler(self) -> None:
        received: list[BaseEvent] = []
        registry = get_registry()

        async def handler(event: BaseEvent) -> None:
            received.append(event)

        registry.register("OrderCompleted", handler)
        bus = get_event_bus()
        await bus.start()

        event = OrderCompleted(restaurant_id="r1", order_id="o1", total_amount=100.0)
        await bus.publish(event)

        assert len(received) == 1
        assert received[0].event_name == "OrderCompleted"

    async def test_publish_multiple_handlers(self) -> None:
        results: list[str] = []
        registry = get_registry()

        async def handler_a(event: BaseEvent) -> None:
            results.append("A")

        async def handler_b(event: BaseEvent) -> None:
            results.append("B")

        registry.register("InsightGenerated", handler_a)
        registry.register("InsightGenerated", handler_b)

        bus = get_event_bus()
        await bus.start()
        await bus.publish(InsightGenerated(restaurant_id="r1"))

        assert sorted(results) == ["A", "B"]

    async def test_publish_no_handlers(self) -> None:
        bus = get_event_bus()
        await bus.start()
        event = OrderCompleted(restaurant_id="r1")
        await bus.publish(event)
        assert bus.stats["total_published"] == 1

    async def test_publish_when_disabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from app.config import settings as settings_mod

        monkeypatch.setattr(settings_mod.settings, "EVENTS_ENABLED", False)

        received: list[BaseEvent] = []
        registry = get_registry()

        async def handler(event: BaseEvent) -> None:
            received.append(event)

        registry.register("OrderCompleted", handler)
        bus = get_event_bus()
        await bus.publish(OrderCompleted(restaurant_id="r1"))
        assert len(received) == 0


@pytest.mark.asyncio
class TestEventBusErrorIsolation:
    async def test_handler_error_does_not_propagate(self) -> None:
        results: list[str] = []
        registry = get_registry()

        async def bad_handler(event: BaseEvent) -> None:
            raise RuntimeError("boom")

        async def good_handler(event: BaseEvent) -> None:
            results.append("ok")

        registry.register("OrderCompleted", bad_handler)
        registry.register("OrderCompleted", good_handler)

        bus = get_event_bus()
        await bus.start()

        # Set retries to 0 so the test runs fast
        from app.config import settings as settings_mod
        original = settings_mod.settings.EVENTS_MAX_RETRIES
        settings_mod.settings.EVENTS_MAX_RETRIES = 0

        await bus.publish(OrderCompleted(restaurant_id="r1"))

        settings_mod.settings.EVENTS_MAX_RETRIES = original

        assert "ok" in results


@pytest.mark.asyncio
class TestEventBusRetry:
    async def test_retry_on_failure(self) -> None:
        call_count = 0
        registry = get_registry()

        async def flaky_handler(event: BaseEvent) -> None:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("transient error")

        registry.register("OrderCompleted", flaky_handler)

        bus = get_event_bus()
        await bus.start()

        from app.config import settings as settings_mod
        original_retries = settings_mod.settings.EVENTS_MAX_RETRIES
        original_delay = settings_mod.settings.EVENTS_RETRY_DELAY_SECONDS
        settings_mod.settings.EVENTS_MAX_RETRIES = 3
        settings_mod.settings.EVENTS_RETRY_DELAY_SECONDS = 0.01

        await bus.publish(OrderCompleted(restaurant_id="r1"))

        settings_mod.settings.EVENTS_MAX_RETRIES = original_retries
        settings_mod.settings.EVENTS_RETRY_DELAY_SECONDS = original_delay

        assert call_count == 3
        assert bus.stats["total_processed"] == 1


@pytest.mark.asyncio
class TestEventBusCollect:
    async def test_publish_and_collect(self) -> None:
        registry = get_registry()

        async def handler(event: BaseEvent) -> dict:
            return {"result": "data"}

        registry.register("InsightGenerated", handler)

        bus = get_event_bus()
        await bus.start()
        results = await bus.publish_and_collect(InsightGenerated(restaurant_id="r1"))

        assert len(results) == 1
        assert results[0]["result"] == "data"


@pytest.mark.asyncio
class TestEventBusStats:
    async def test_stats_tracking(self) -> None:
        registry = get_registry()

        async def handler(event: BaseEvent) -> None:
            pass

        registry.register("OrderCompleted", handler)

        bus = get_event_bus()
        await bus.start()

        await bus.publish(OrderCompleted(restaurant_id="r1"))
        await bus.publish(OrderCompleted(restaurant_id="r2"))

        stats = bus.stats
        assert stats["total_published"] == 2
        assert stats["total_processed"] == 2
        assert stats["total_failed"] == 0
