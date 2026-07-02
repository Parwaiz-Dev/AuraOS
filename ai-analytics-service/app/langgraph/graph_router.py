"""Graph Router — conditional edge routing logic."""

from __future__ import annotations

import logging
from typing import Any, Callable

from app.langgraph.graph_state import GraphState

logger = logging.getLogger(__name__)

RoutingFn = Callable[[GraphState], str]


class Route:
    """A conditional edge from source to one of several destinations."""

    __slots__ = ("source", "destinations", "condition")

    def __init__(
        self,
        source: str,
        destinations: dict[str, str],
        condition: RoutingFn,
    ) -> None:
        self.source = source
        self.destinations = destinations
        self.condition = condition

    def resolve(self, state: GraphState) -> str:
        key = self.condition(state)
        dest = self.destinations.get(key)
        if dest is None:
            dest = self.destinations.get("default", "")
        if not dest:
            logger.warning(
                "Route from '%s' returned key '%s' with no matching destination",
                self.source, key,
            )
        return dest


class GraphRouter:
    """Manages all routing rules for a graph."""

    def __init__(self) -> None:
        self._routes: dict[str, Route] = {}
        self._edges: dict[str, str] = {}

    def add_edge(self, source: str, destination: str) -> None:
        self._edges[source] = destination

    def add_conditional_edge(
        self,
        source: str,
        destinations: dict[str, str],
        condition: RoutingFn,
    ) -> None:
        self._routes[source] = Route(source, destinations, condition)

    def get_next(self, node: str, state: GraphState) -> str:
        if node in self._routes:
            return self._routes[node].resolve(state)
        return self._edges.get(node, "")

    def has_route(self, node: str) -> bool:
        return node in self._routes or node in self._edges

    def get_all_edges(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for src, dst in self._edges.items():
            result[src] = {"type": "direct", "destination": dst}
        for src, route in self._routes.items():
            result[src] = {
                "type": "conditional",
                "destinations": route.destinations,
            }
        return result
