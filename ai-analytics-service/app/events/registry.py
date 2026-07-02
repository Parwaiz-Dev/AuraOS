"""Handler registry — maps event types to async handler callables."""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable, Coroutine
from typing import Any

from app.events.event import BaseEvent

logger = logging.getLogger(__name__)

HandlerFunc = Callable[[BaseEvent], Coroutine[Any, Any, Any]]


class HandlerRegistry:
    """Thread-safe registry of event handlers.

    Supports multiple handlers per event type.  Handlers are async callables
    that accept a single ``BaseEvent`` argument.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[HandlerFunc]] = defaultdict(list)

    def register(self, event_name: str, handler: HandlerFunc) -> None:
        if handler not in self._handlers[event_name]:
            self._handlers[event_name].append(handler)
            logger.debug("Registered handler %s for %s", handler.__qualname__, event_name)

    def unregister(self, event_name: str, handler: HandlerFunc) -> None:
        handlers = self._handlers.get(event_name, [])
        if handler in handlers:
            handlers.remove(handler)
            logger.debug("Unregistered handler %s from %s", handler.__qualname__, event_name)

    def get_handlers(self, event_name: str) -> list[HandlerFunc]:
        return list(self._handlers.get(event_name, []))

    def get_all_handlers(self) -> dict[str, list[HandlerFunc]]:
        return dict(self._handlers)

    def clear(self) -> None:
        self._handlers.clear()

    @property
    def handler_count(self) -> int:
        return sum(len(h) for h in self._handlers.values())


_registry = HandlerRegistry()


def get_registry() -> HandlerRegistry:
    return _registry


def reset_registry() -> None:
    _registry.clear()
