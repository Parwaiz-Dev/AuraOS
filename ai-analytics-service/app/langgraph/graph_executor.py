"""Graph Executor — runs a built graph definition to completion."""

from __future__ import annotations

import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.langgraph.exceptions import GraphExecutionError, GraphTimeoutError
from app.langgraph.graph_builder import GraphDefinition
from app.langgraph.graph_state import GraphState

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 300.0


class GraphExecutor:
    """Walks a GraphDefinition from entry point to END, executing each node."""

    def __init__(self) -> None:
        self._history: deque[dict[str, Any]] = deque(maxlen=200)
        self._stats = {
            "total_runs": 0,
            "successful": 0,
            "failed": 0,
            "timed_out": 0,
        }

    async def run(
        self,
        graph: GraphDefinition,
        *,
        restaurant_id: str = "",
        user_id: str = "",
        query: str = "",
        context: dict[str, Any] | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> GraphState:
        self._stats["total_runs"] += 1

        state = GraphState(
            graph_id=graph.graph_id,
            restaurant_id=restaurant_id,
            user_id=user_id,
            query=query,
            status="running",
        )
        if context:
            state.context.update(context)

        t0 = time.monotonic()
        current = graph.entry_point

        try:
            while current and current != "END":
                if time.monotonic() - t0 > timeout:
                    state.status = "timed_out"
                    self._stats["timed_out"] += 1
                    raise GraphTimeoutError(graph.graph_id, timeout)

                if not state.check_iteration_limit():
                    state.status = "failed"
                    state.add_error("Max iteration limit reached")
                    break

                node = graph.get_node(current)
                if node is None:
                    state.add_error(f"Node '{current}' not found")
                    state.status = "failed"
                    break

                state = await node.run(state)

                if state.pending_approval:
                    break

                result = state.get_result(current)
                if result and result.status == "failed":
                    from app.self_healing.circuit_breaker import get_circuit_breaker
                    cb = get_circuit_breaker(f"graph:{current}")
                    cb.record_failure()
                else:
                    from app.self_healing.circuit_breaker import get_circuit_breaker
                    cb = get_circuit_breaker(f"graph:{current}")
                    cb.record_success()

                next_node = graph.router.get_next(current, state)
                current = next_node

            if not state.pending_approval and state.status == "running":
                state.status = "completed"
                self._stats["successful"] += 1

        except GraphTimeoutError:
            state.add_error(f"Graph timed out after {timeout}s")
        except Exception as exc:
            state.status = "failed"
            state.add_error(str(exc))
            self._stats["failed"] += 1
            logger.error("Graph '%s' failed: %s", graph.graph_id, exc)

        elapsed = (time.monotonic() - t0) * 1000
        state.duration_ms = round(elapsed, 2)
        state.completed_at = datetime.now(timezone.utc).isoformat()

        from app.self_healing.metrics import get_metrics_collector
        collector = get_metrics_collector()
        collector.record_latency("graph_execution", elapsed)

        record = {
            "graph_id": graph.graph_id,
            "run_id": state.run_id,
            "status": state.status,
            "duration_ms": state.duration_ms,
            "nodes_visited": state.visited_nodes,
            "errors": state.errors,
        }
        self._history.appendleft(record)

        try:
            from app.langgraph.graph_memory import get_graph_memory
            memory = get_graph_memory()
            await memory.record_execution(restaurant_id, record)
        except Exception:
            pass

        try:
            from app.events.event import BaseEvent
            from app.events.publisher import publish
            await publish(BaseEvent(
                event_name="GraphExecutionCompleted",
                restaurant_id=restaurant_id,
                metadata={
                    "graph_id": graph.graph_id,
                    "status": state.status,
                    "duration_ms": state.duration_ms,
                },
            ))
        except Exception:
            pass

        return state

    async def resume(
        self,
        graph: GraphDefinition,
        state: GraphState,
        *,
        approved: bool = True,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> GraphState:
        """Resume a graph that was paused for human approval."""
        if not state.pending_approval:
            return state

        state.pending_approval = False
        approval_node = state.approval_node
        state.approval_node = ""

        if not approved:
            state.status = "cancelled"
            state.add_error("Human approval denied")
            return state

        state.status = "running"
        state.set_result(approval_node, state.get_result(approval_node) or __import__(
            "app.langgraph.graph_state", fromlist=["NodeResult"]
        ).NodeResult(node=approval_node, status="approved"))

        current = graph.router.get_next(approval_node, state)

        t0 = time.monotonic()
        while current and current != "END":
            if time.monotonic() - t0 > timeout:
                state.status = "timed_out"
                break

            if not state.check_iteration_limit():
                state.status = "failed"
                state.add_error("Max iteration limit reached")
                break

            node = graph.get_node(current)
            if node is None:
                state.add_error(f"Node '{current}' not found")
                state.status = "failed"
                break

            state = await node.run(state)
            if state.pending_approval:
                break

            current = graph.router.get_next(current, state)

        if not state.pending_approval and state.status == "running":
            state.status = "completed"

        state.duration_ms += round((time.monotonic() - t0) * 1000, 2)
        state.completed_at = datetime.now(timezone.utc).isoformat()
        return state

    def get_history(self, limit: int = 50) -> list[dict[str, Any]]:
        return list(self._history)[:limit]

    def get_stats(self) -> dict[str, Any]:
        return dict(self._stats)

    def reset(self) -> None:
        self._history.clear()
        for key in self._stats:
            self._stats[key] = 0


_executor: GraphExecutor | None = None


def get_graph_executor() -> GraphExecutor:
    global _executor
    if _executor is None:
        _executor = GraphExecutor()
    return _executor


def reset_graph_executor() -> None:
    global _executor
    _executor = None
