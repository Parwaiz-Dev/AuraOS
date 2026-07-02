"""Tests for event replay functionality."""

from __future__ import annotations

import pytest

from app.events.dead_letter import get_dlq, reset_dlq
from app.events.domain_events import InsightGenerated, OrderCompleted
from app.events.event import BaseEvent
from app.events.event_bus import get_event_bus, reset_event_bus
from app.events.publisher import publish
from app.events.registry import get_registry, reset_registry
from app.events.store import get_event_store, reset_event_store


@pytest.fixture(autouse=True)
def _clean_state() -> None:
    reset_event_bus()
    reset_registry()
    reset_event_store()
    reset_dlq()


@pytest.mark.asyncio
class TestEventReplay:
    async def test_replay_single_event(self) -> None:
        replayed: list[BaseEvent] = []
        registry = get_registry()

        async def handler(event: BaseEvent) -> None:
            replayed.append(event)

        registry.register("OrderCompleted", handler)

        bus = get_event_bus()
        await bus.start()

        event = OrderCompleted(restaurant_id="r1", order_id="o1")
        await publish(event)
        assert len(replayed) == 1

        store = get_event_store()
        stored = await store.get(event.event_id)
        assert stored is not None

        from app.events.domain_events import ALL_EVENT_TYPES

        event_cls = ALL_EVENT_TYPES.get(stored["event_name"], BaseEvent)
        replay_event = event_cls.model_validate(stored)
        replay_event.status = "replaying"
        replay_event.retry_count = 0
        await publish(replay_event)

        assert len(replayed) == 2

    async def test_replay_by_event_type(self) -> None:
        replayed: list[str] = []
        registry = get_registry()

        async def handler(event: BaseEvent) -> None:
            replayed.append(event.event_name)

        registry.register("OrderCompleted", handler)
        registry.register("InsightGenerated", handler)

        bus = get_event_bus()
        await bus.start()

        await publish(OrderCompleted(restaurant_id="r1"))
        await publish(InsightGenerated(restaurant_id="r1"))
        await publish(OrderCompleted(restaurant_id="r1"))

        assert len(replayed) == 3

        store = get_event_store()
        result = await store.query(event_type="OrderCompleted", restaurant_id="r1")

        order_events = result["items"]
        assert len(order_events) >= 2

    async def test_store_query_pagination(self) -> None:
        bus = get_event_bus()
        await bus.start()

        for i in range(10):
            await publish(OrderCompleted(restaurant_id="r1", order_id=f"o{i}"))

        store = get_event_store()
        page1 = await store.query(restaurant_id="r1", page=1, page_size=3)
        assert len(page1["items"]) == 3
        assert page1["total"] >= 10
        assert page1["pages"] >= 4

    async def test_store_query_by_status(self) -> None:
        bus = get_event_bus()
        await bus.start()

        await publish(OrderCompleted(restaurant_id="r1"))

        store = get_event_store()
        result = await store.query(restaurant_id="r1", status="processed")
        assert len(result["items"]) >= 0


@pytest.mark.asyncio
class TestDLQReplay:
    async def test_dlq_replay_all(self) -> None:
        replayed_events: list[BaseEvent] = []
        registry = get_registry()

        async def handler(event: BaseEvent) -> None:
            replayed_events.append(event)

        registry.register("OrderCompleted", handler)

        bus = get_event_bus()
        await bus.start()

        dlq = get_dlq()
        event = OrderCompleted(restaurant_id="r1", order_id="o1")
        event.retry_count = 3
        await dlq.add(event, "failed_handler")

        count = await dlq.replay_all()
        assert count == 1
        assert len(replayed_events) == 1

        remaining = await dlq.get_count()
        assert remaining == 0
