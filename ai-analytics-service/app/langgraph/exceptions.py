"""LangGraph exceptions."""

from __future__ import annotations


class GraphError(Exception):
    """Base exception for the graph orchestration subsystem."""


class GraphBuildError(GraphError):
    """Failed to build the graph definition."""


class GraphExecutionError(GraphError):
    """A graph execution run failed."""

    def __init__(self, graph_id: str, reason: str = "") -> None:
        self.graph_id = graph_id
        super().__init__(f"Graph '{graph_id}' execution failed: {reason}")


class GraphNodeError(GraphError):
    """A node within the graph raised an error."""

    def __init__(self, node: str, reason: str = "") -> None:
        self.node = node
        super().__init__(f"Node '{node}' failed: {reason}")


class GraphRoutingError(GraphError):
    """Routing logic produced an invalid destination."""

    def __init__(self, source: str, reason: str = "") -> None:
        self.source = source
        super().__init__(f"Routing from '{source}' failed: {reason}")


class GraphTimeoutError(GraphError):
    """Graph execution exceeded the allowed time."""

    def __init__(self, graph_id: str, timeout: float) -> None:
        self.graph_id = graph_id
        super().__init__(f"Graph '{graph_id}' timed out after {timeout}s")
