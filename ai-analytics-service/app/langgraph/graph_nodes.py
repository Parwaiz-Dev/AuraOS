"""Graph Nodes — pluggable node types for the orchestration graph."""

from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Any

from app.langgraph.graph_state import GraphState, NodeResult

logger = logging.getLogger(__name__)


class GraphNode(ABC):
    """Base for all graph nodes."""

    name: str = "base_node"
    timeout: float = 120.0

    @abstractmethod
    async def execute(self, state: GraphState) -> GraphState:
        ...

    async def run(self, state: GraphState) -> GraphState:
        t0 = time.monotonic()
        state.mark_visited(self.name)
        try:
            result_state = await asyncio.wait_for(
                self.execute(state),
                timeout=self.timeout,
            )
            elapsed = (time.monotonic() - t0) * 1000
            result = state.get_result(self.name)
            if result is not None:
                result.duration_ms = elapsed
            return result_state
        except asyncio.TimeoutError:
            elapsed = (time.monotonic() - t0) * 1000
            state.set_result(self.name, NodeResult(
                node=self.name, status="timeout",
                error=f"Timed out after {self.timeout}s",
                duration_ms=elapsed,
            ))
            state.add_error(f"Node '{self.name}' timed out")
            return state
        except Exception as exc:
            elapsed = (time.monotonic() - t0) * 1000
            state.set_result(self.name, NodeResult(
                node=self.name, status="failed",
                error=str(exc), duration_ms=elapsed,
            ))
            state.add_error(f"Node '{self.name}': {exc}")
            return state


class AgentNode(GraphNode):
    """Runs a specialized agent by ID."""

    def __init__(self, agent_id: str) -> None:
        self.name = f"agent:{agent_id}"
        self._agent_id = agent_id

    async def execute(self, state: GraphState) -> GraphState:
        from app.agents.registry import get_agent
        agent = get_agent(self._agent_id)
        if agent is None:
            state.set_result(self.name, NodeResult(
                node=self.name, status="skipped",
                error=f"Agent '{self._agent_id}' not found",
            ))
            return state

        result = await agent.process({
            "restaurant_id": state.restaurant_id,
            "query": state.query,
            **state.context,
        })
        state.set_result(self.name, NodeResult(
            node=self.name, status="success", data=result,
        ))
        state.context[self._agent_id] = result
        return state


class ToolNode(GraphNode):
    """Runs an MCP tool."""

    def __init__(self, tool_name: str, parameters: dict[str, Any] | None = None) -> None:
        self.name = f"tool:{tool_name}"
        self._tool_name = tool_name
        self._parameters = parameters or {}

    async def execute(self, state: GraphState) -> GraphState:
        from app.mcp.registry import get_mcp_registry
        registry = get_mcp_registry()
        tool = registry.get_tool(self._tool_name)
        if tool is None:
            state.set_result(self.name, NodeResult(
                node=self.name, status="skipped",
                error=f"Tool '{self._tool_name}' not found",
            ))
            return state

        params = {**self._parameters, "restaurant_id": state.restaurant_id}
        result = await tool.execute(params)
        state.set_result(self.name, NodeResult(
            node=self.name, status="success", data=result,
        ))
        return state


class DecisionNode(GraphNode):
    """Evaluates a condition and sets a routing key in context."""

    def __init__(self, name: str, condition_fn: Any) -> None:
        self.name = name
        self._condition_fn = condition_fn

    async def execute(self, state: GraphState) -> GraphState:
        result = self._condition_fn(state)
        if asyncio.iscoroutine(result):
            result = await result
        state.context[f"_decision:{self.name}"] = result
        state.set_result(self.name, NodeResult(
            node=self.name, status="success",
            data={"decision": result},
        ))
        return state


class HumanApprovalNode(GraphNode):
    """Pauses graph execution until human approval."""

    def __init__(self, name: str = "human_approval") -> None:
        self.name = name

    async def execute(self, state: GraphState) -> GraphState:
        state.pending_approval = True
        state.approval_node = self.name
        state.status = "awaiting_approval"
        state.set_result(self.name, NodeResult(
            node=self.name, status="pending",
            data={"awaiting": "human_approval"},
        ))
        return state


class MemoryNode(GraphNode):
    """Loads or stores data in graph memory."""

    def __init__(self, name: str, action: str = "load") -> None:
        self.name = name
        self._action = action

    async def execute(self, state: GraphState) -> GraphState:
        from app.langgraph.graph_memory import get_graph_memory
        memory = get_graph_memory()

        if self._action == "load":
            data = await memory.load_context(state.restaurant_id, state.graph_id)
            state.context.update(data)
            state.set_result(self.name, NodeResult(
                node=self.name, status="success",
                data={"loaded_keys": list(data.keys())},
            ))
        elif self._action == "save":
            await memory.save_context(
                state.restaurant_id,
                state.graph_id,
                state.context,
            )
            state.set_result(self.name, NodeResult(
                node=self.name, status="success",
                data={"saved_keys": list(state.context.keys())},
            ))
        return state


class ParallelNode(GraphNode):
    """Executes multiple child nodes concurrently."""

    def __init__(self, name: str, children: list[GraphNode]) -> None:
        self.name = name
        self._children = children

    async def execute(self, state: GraphState) -> GraphState:
        tasks = [child.run(GraphState(**state.model_dump())) for child in self._children]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        merged_data: dict[str, Any] = {}
        for child, result in zip(self._children, results):
            if isinstance(result, GraphState):
                child_result = result.get_result(child.name)
                if child_result is not None:
                    state.set_result(child.name, child_result)
                    merged_data[child.name] = child_result.data
                state.context.update(result.context)
            elif isinstance(result, Exception):
                state.set_result(child.name, NodeResult(
                    node=child.name, status="failed", error=str(result),
                ))

        state.set_result(self.name, NodeResult(
            node=self.name, status="success", data=merged_data,
        ))
        return state
