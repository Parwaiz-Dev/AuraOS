"""Tests for the Dead Letter Queue."""

from __future__ import annotations

import pytest

from app.events.dead_letter import DeadLetterQueue, get_dlq, reset_dlq
from app.events.domain_events import OrderCompleted
from app.events.event import BaseEvent
from app.events.event_bus import get_event_bus, reset_event_bus
from app.events.registry import get_registry, reset_registry


@pytest.fixture(autouse=True)
def _clean_state() -> None:
    reset_event_bus()
    reset_registry()
    reset_dlq()


@pytest.mark.asyncio
class TestDeadLetterQueue:
    async def test_add_and_retrieve(self) -> None:
        dlq = get_dlq()
        event = OrderCompleted(restaurant_id="r1", order_id="o1")
        event.retry_count = 3

        await dlq.add(event, "test_handler")

        entries = await dlq.get_all()
        assert len(entries) == 1
        assert entries[0]["handler_name"] == "test_handler"
        assert entries[0]["retry_count"] == 3
        assert entries[0]["event"]["event_name"] == "OrderCompleted"

    async def test_get_count(self) -> None:
        dlq = get_dlq()

        event1 = OrderCompleted(restaurant_id="r1")
        event2 = OrderCompleted(restaurant_id="r2")

        await dlq.add(event1, "handler_a")
        await dlq.add(event2, "handler_b")

        count = await dlq.get_count()
        assert count == 2

    async def test_clear(self) -> None:
        dlq = get_dlq()
        await dlq.add(OrderCompleted(restaurant_id="r1"), "handler")
        await dlq.add(OrderCompleted(restaurant_id="r2"), "handler")

        cleared = await dlq.clear()
        assert cleared == 2

        count = await dlq.get_count()
        assert count == 0

    async def test_get_stats(self) -> None:
        dlq = get_dlq()
        await dlq.add(OrderCompleted(restaurant_id="r1"), "handler_a")
        await dlq.add(OrderCompleted(restaurant_id="r2"), "handler_b")
        await dlq.add(OrderCompleted(restaurant_id="r3"), "handler_a")

        stats = await dlq.get_stats()
        assert stats["total_failed"] == 3
        assert stats["by_handler"]["handler_a"] == 2
        assert stats["by_handler"]["handler_b"] == 1
        assert stats["by_event_type"]["OrderCompleted"] == 3


@pytest.mark.asyncio
class TestDeadLetterFromBus:
    async def test_failed_handler_goes_to_dlq(self) -> None:
        registry = get_registry()

        async def always_fail(event: BaseEvent) -> None:
            raise RuntimeError("permanent failure")

        registry.register("OrderCompleted", always_fail)

        bus = get_event_bus()
        await bus.start()

        from app.config import settings as settings_mod
        original_retries = settings_mod.settings.EVENTS_MAX_RETRIES
        original_delay = settings_mod.settings.EVENTS_RETRY_DELAY_SECONDS
        settings_mod.settings.EVENTS_MAX_RETRIES = 1
        settings_mod.settings.EVENTS_RETRY_DELAY_SECONDS = 0.01

        await bus.publish(OrderCompleted(restaurant_id="r1", order_id="o1"))

        settings_mod.settings.EVENTS_MAX_RETRIES = original_retries
        settings_mod.settings.EVENTS_RETRY_DELAY_SECONDS = original_delay

        dlq = get_dlq()
        count = await dlq.get_count()
        assert count >= 1

        entries = await dlq.get_all()
        assert entries[0]["event"]["order_id"] == "o1"
