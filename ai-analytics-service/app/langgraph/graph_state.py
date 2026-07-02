"""Graph State — shared execution state flowing through nodes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class NodeResult(BaseModel):
    """Result produced by a single graph node."""

    node: str = ""
    status: str = "success"
    data: dict[str, Any] = Field(default_factory=dict)
    error: str = ""
    duration_ms: float = 0.0


class GraphState(BaseModel):
    """Immutable snapshot of graph execution flowing through every node."""

    graph_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str = ""
    user_id: str = ""
    query: str = ""

    current_node: str = ""
    visited_nodes: list[str] = Field(default_factory=list)
    node_results: dict[str, NodeResult] = Field(default_factory=dict)

    metadata: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)

    status: str = "pending"
    started_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    completed_at: str = ""
    duration_ms: float = 0.0

    iteration: int = 0
    max_iterations: int = 50

    pending_approval: bool = False
    approval_node: str = ""

    def mark_visited(self, node: str) -> None:
        self.current_node = node
        if node not in self.visited_nodes:
            self.visited_nodes.append(node)

    def set_result(self, node: str, result: NodeResult) -> None:
        self.node_results[node] = result

    def get_result(self, node: str) -> NodeResult | None:
        return self.node_results.get(node)

    def add_error(self, error: str) -> None:
        self.errors.append(error)

    def is_complete(self) -> bool:
        return self.status in ("completed", "failed", "cancelled", "timed_out")

    def check_iteration_limit(self) -> bool:
        self.iteration += 1
        return self.iteration <= self.max_iterations
