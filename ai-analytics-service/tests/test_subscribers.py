"""Tests for the @subscribe decorator and handler registration."""

from __future__ import annotations

import pytest

from app.events.domain_events import (
    InsightGenerated,
    InventoryLow,
    ModelRetrained,
    OrderCompleted,
)
from app.events.event import BaseEvent
from app.events.event_bus import get_event_bus, reset_event_bus
from app.events.registry import get_registry, reset_registry
from app.events.subscriber import subscribe


@pytest.fixture(autouse=True)
def _clean_state() -> None:
    reset_event_bus()
    reset_registry()


class TestSubscribeDecorator:
    def test_subscribe_single_event(self) -> None:
        @subscribe(OrderCompleted)
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        handlers = registry.get_handlers("OrderCompleted")
        assert len(handlers) == 1
        assert handlers[0] is handler

    def test_subscribe_multiple_events(self) -> None:
        @subscribe(OrderCompleted, InsightGenerated)
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        assert len(registry.get_handlers("OrderCompleted")) == 1
        assert len(registry.get_handlers("InsightGenerated")) == 1

    def test_multiple_handlers_same_event(self) -> None:
        @subscribe(OrderCompleted)
        async def handler_a(event: BaseEvent) -> None:
            pass

        @subscribe(OrderCompleted)
        async def handler_b(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        handlers = registry.get_handlers("OrderCompleted")
        assert len(handlers) == 2

    def test_no_duplicate_registration(self) -> None:
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        registry.register("OrderCompleted", handler)
        registry.register("OrderCompleted", handler)

        handlers = registry.get_handlers("OrderCompleted")
        assert len(handlers) == 1


class TestHandlerRegistry:
    def test_unregister(self) -> None:
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        registry.register("OrderCompleted", handler)
        assert len(registry.get_handlers("OrderCompleted")) == 1

        registry.unregister("OrderCompleted", handler)
        assert len(registry.get_handlers("OrderCompleted")) == 0

    def test_clear(self) -> None:
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        registry.register("OrderCompleted", handler)
        registry.register("InsightGenerated", handler)

        registry.clear()
        assert registry.handler_count == 0

    def test_handler_count(self) -> None:
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        registry.register("OrderCompleted", handler)
        registry.register("InsightGenerated", handler)
        registry.register("ModelRetrained", handler)

        assert registry.handler_count == 3

    def test_get_all_handlers(self) -> None:
        async def handler(event: BaseEvent) -> None:
            pass

        registry = get_registry()
        registry.register("OrderCompleted", handler)
        registry.register("InsightGenerated", handler)

        all_handlers = registry.get_all_handlers()
        assert "OrderCompleted" in all_handlers
        assert "InsightGenerated" in all_handlers


@pytest.mark.asyncio
class TestHandlerIndependence:
    async def test_handlers_run_independently(self) -> None:
        results: list[str] = []

        @subscribe(OrderCompleted)
        async def handler_a(event: BaseEvent) -> None:
            results.append("A")

        @subscribe(OrderCompleted)
        async def handler_b(event: BaseEvent) -> None:
            raise RuntimeError("B fails")

        @subscribe(OrderCompleted)
        async def handler_c(event: BaseEvent) -> None:
            results.append("C")

        bus = get_event_bus()
        await bus.start()

        from app.config import settings as settings_mod
        original = settings_mod.settings.EVENTS_MAX_RETRIES
        settings_mod.settings.EVENTS_MAX_RETRIES = 0

        await bus.publish(OrderCompleted(restaurant_id="r1"))

        settings_mod.settings.EVENTS_MAX_RETRIES = original

        assert "A" in results
        assert "C" in results

    async def test_handler_does_not_call_another_handler(self) -> None:
        """Handlers only communicate via events, never directly."""
        handler_b_called = False

        @subscribe(OrderCompleted)
        async def handler_a(event: BaseEvent) -> None:
            from app.events.publisher import publish
            await publish(InsightGenerated(restaurant_id=event.restaurant_id))

        @subscribe(InsightGenerated)
        async def handler_b(event: BaseEvent) -> None:
            nonlocal handler_b_called
            handler_b_called = True

        bus = get_event_bus()
        await bus.start()

        await bus.publish(OrderCompleted(restaurant_id="r1"))

        assert handler_b_called


@pytest.mark.asyncio
class TestBuiltinHandlers:
    async def test_all_handlers_register_on_import(self) -> None:
        import app.events.handlers  # noqa: F401

        registry = get_registry()
        assert registry.handler_count > 0

        all_handlers = registry.get_all_handlers()
        assert "ModelRetrained" in all_handlers
        assert "InsightGenerated" in all_handlers
        assert "OrderCompleted" in all_handlers
        assert "InventoryLow" in all_handlers
        assert "BaseEvent" in all_handlers
