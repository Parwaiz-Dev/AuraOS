"""Subscriber decorator — auto-registers async handlers for event types."""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Any

from app.events.event import BaseEvent
from app.events.registry import get_registry


def subscribe(
    *event_types: type[BaseEvent],
) -> Callable[
    [Callable[[BaseEvent], Coroutine[Any, Any, Any]]],
    Callable[[BaseEvent], Coroutine[Any, Any, Any]],
]:
    """Decorator that registers an async handler for one or more event types.

    Usage::

        @subscribe(OrderCompleted, PaymentCompleted)
        async def handle_order(event: BaseEvent) -> None:
            ...
    """

    def decorator(
        func: Callable[[BaseEvent], Coroutine[Any, Any, Any]],
    ) -> Callable[[BaseEvent], Coroutine[Any, Any, Any]]:
        registry = get_registry()
        for event_type in event_types:
            event_name = event_type.__name__
            registry.register(event_name, func)
        return func

    return decorator
