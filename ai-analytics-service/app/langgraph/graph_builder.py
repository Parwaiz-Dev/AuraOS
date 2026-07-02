"""Graph Builder — fluent API for constructing execution graphs."""

from __future__ import annotations

import logging
from typing import Any, Callable

from app.langgraph.graph_nodes import (
    AgentNode,
    DecisionNode,
    GraphNode,
    HumanApprovalNode,
    MemoryNode,
    ParallelNode,
    ToolNode,
)
from app.langgraph.graph_router import GraphRouter

logger = logging.getLogger(__name__)


class GraphDefinition:
    """Immutable graph structure built by GraphBuilder."""

    def __init__(
        self,
        graph_id: str,
        nodes: dict[str, GraphNode],
        router: GraphRouter,
        entry_point: str,
    ) -> None:
        self.graph_id = graph_id
        self.nodes = nodes
        self.router = router
        self.entry_point = entry_point

    def get_node(self, name: str) -> GraphNode | None:
        return self.nodes.get(name)

    def get_topology(self) -> dict[str, Any]:
        return {
            "graph_id": self.graph_id,
            "entry_point": self.entry_point,
            "nodes": list(self.nodes.keys()),
            "edges": self.router.get_all_edges(),
        }


class GraphBuilder:
    """Fluent builder for constructing graph definitions."""

    def __init__(self, graph_id: str = "default") -> None:
        self._graph_id = graph_id
        self._nodes: dict[str, GraphNode] = {}
        self._router = GraphRouter()
        self._entry_point: str = ""

    def add_node(self, node: GraphNode) -> "GraphBuilder":
        self._nodes[node.name] = node
        return self

    def add_agent_node(self, agent_id: str) -> "GraphBuilder":
        node = AgentNode(agent_id)
        self._nodes[node.name] = node
        return self

    def add_tool_node(
        self, tool_name: str, parameters: dict[str, Any] | None = None,
    ) -> "GraphBuilder":
        node = ToolNode(tool_name, parameters)
        self._nodes[node.name] = node
        return self

    def add_decision_node(self, name: str, condition: Callable[..., Any]) -> "GraphBuilder":
        node = DecisionNode(name, condition)
        self._nodes[node.name] = node
        return self

    def add_approval_node(self, name: str = "human_approval") -> "GraphBuilder":
        node = HumanApprovalNode(name)
        self._nodes[node.name] = node
        return self

    def add_memory_node(self, name: str, action: str = "load") -> "GraphBuilder":
        node = MemoryNode(name, action)
        self._nodes[node.name] = node
        return self

    def add_parallel_node(
        self, name: str, children: list[GraphNode],
    ) -> "GraphBuilder":
        node = ParallelNode(name, children)
        self._nodes[node.name] = node
        return self

    def add_edge(self, source: str, destination: str) -> "GraphBuilder":
        self._router.add_edge(source, destination)
        return self

    def add_conditional_edge(
        self,
        source: str,
        destinations: dict[str, str],
        condition: Callable[..., str],
    ) -> "GraphBuilder":
        self._router.add_conditional_edge(source, destinations, condition)
        return self

    def set_entry_point(self, node_name: str) -> "GraphBuilder":
        self._entry_point = node_name
        return self

    def build(self) -> GraphDefinition:
        from app.langgraph.exceptions import GraphBuildError

        if not self._entry_point:
            raise GraphBuildError("Entry point not set")
        if self._entry_point not in self._nodes:
            raise GraphBuildError(
                f"Entry point '{self._entry_point}' not found in nodes"
            )
        return GraphDefinition(
            graph_id=self._graph_id,
            nodes=dict(self._nodes),
            router=self._router,
            entry_point=self._entry_point,
        )
