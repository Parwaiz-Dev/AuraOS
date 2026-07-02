"""Pre-built graph definitions — reusable graph templates."""

from __future__ import annotations

from typing import Any

from app.langgraph.graph_builder import GraphBuilder, GraphDefinition
from app.langgraph.graph_nodes import (
    AgentNode,
    DecisionNode,
    GraphNode,
    HumanApprovalNode,
    MemoryNode,
    ParallelNode,
)
from app.langgraph.graph_state import GraphState

_registry: dict[str, GraphDefinition] = {}


def _build_analytics_graph() -> GraphDefinition:
    """Multi-agent analytics graph with parallel agent execution."""

    def _route_by_domain(state: GraphState) -> str:
        query = state.query.lower()
        if any(k in query for k in ("revenue", "sales", "money", "income")):
            return "revenue"
        if any(k in query for k in ("inventory", "stock", "supply")):
            return "inventory"
        if any(k in query for k in ("forecast", "predict", "future")):
            return "forecast"
        if any(k in query for k in ("customer", "segment", "churn")):
            return "customer"
        return "multi"

    parallel = ParallelNode("parallel_agents", [
        AgentNode("analytics_agent"),
        AgentNode("revenue_agent"),
        AgentNode("forecasting_agent"),
    ])

    builder = (
        GraphBuilder("analytics")
        .add_memory_node("load_memory", "load")
        .add_decision_node("router", _route_by_domain)
        .add_agent_node("revenue_agent")
        .add_agent_node("inventory_agent")
        .add_agent_node("forecasting_agent")
        .add_agent_node("customer_agent")
        .add_parallel_node("parallel_agents", parallel._children)
        .add_memory_node("save_memory", "save")
        .set_entry_point("load_memory")
        .add_edge("load_memory", "router")
        .add_conditional_edge("router", {
            "revenue": "agent:revenue_agent",
            "inventory": "agent:inventory_agent",
            "forecast": "agent:forecasting_agent",
            "customer": "agent:customer_agent",
            "multi": "parallel_agents",
            "default": "parallel_agents",
        }, _route_by_domain)
        .add_edge("agent:revenue_agent", "save_memory")
        .add_edge("agent:inventory_agent", "save_memory")
        .add_edge("agent:forecasting_agent", "save_memory")
        .add_edge("agent:customer_agent", "save_memory")
        .add_edge("parallel_agents", "save_memory")
        .add_edge("save_memory", "END")
    )
    return builder.build()


def _build_autonomous_graph() -> GraphDefinition:
    """Autonomous decision graph with human approval gate."""

    def _needs_approval(state: GraphState) -> str:
        confidence = state.context.get("confidence", 0.0)
        risk = state.context.get("risk", "LOW")
        if risk == "HIGH" or confidence < 0.7:
            return "needs_approval"
        return "auto_execute"

    builder = (
        GraphBuilder("autonomous")
        .add_memory_node("load_context", "load")
        .add_agent_node("monitoring_agent")
        .add_decision_node("approval_gate", _needs_approval)
        .add_approval_node("human_approval")
        .add_agent_node("operations_agent")
        .add_memory_node("save_context", "save")
        .set_entry_point("load_context")
        .add_edge("load_context", "agent:monitoring_agent")
        .add_edge("agent:monitoring_agent", "approval_gate")
        .add_conditional_edge("approval_gate", {
            "needs_approval": "human_approval",
            "auto_execute": "agent:operations_agent",
            "default": "agent:operations_agent",
        }, _needs_approval)
        .add_edge("human_approval", "agent:operations_agent")
        .add_edge("agent:operations_agent", "save_context")
        .add_edge("save_context", "END")
    )
    return builder.build()


def _build_healing_graph() -> GraphDefinition:
    """Self-healing graph: detect → diagnose → recover."""

    def _recovery_route(state: GraphState) -> str:
        errors = state.errors
        if not errors:
            return "healthy"
        return "needs_recovery"

    builder = (
        GraphBuilder("self_healing")
        .add_agent_node("monitoring_agent")
        .add_decision_node("health_check", _recovery_route)
        .add_agent_node("operations_agent")
        .add_memory_node("save_results", "save")
        .set_entry_point("agent:monitoring_agent")
        .add_edge("agent:monitoring_agent", "health_check")
        .add_conditional_edge("health_check", {
            "healthy": "save_results",
            "needs_recovery": "agent:operations_agent",
            "default": "save_results",
        }, _recovery_route)
        .add_edge("agent:operations_agent", "save_results")
        .add_edge("save_results", "END")
    )
    return builder.build()


def register_default_graphs() -> None:
    """Register all pre-built graph definitions."""
    _registry["analytics"] = _build_analytics_graph()
    _registry["autonomous"] = _build_autonomous_graph()
    _registry["self_healing"] = _build_healing_graph()


def get_graph(graph_id: str) -> GraphDefinition | None:
    if not _registry:
        register_default_graphs()
    return _registry.get(graph_id)


def register_graph(graph_id: str, graph: GraphDefinition) -> None:
    _registry[graph_id] = graph


def list_graphs() -> list[dict[str, Any]]:
    if not _registry:
        register_default_graphs()
    return [
        {
            "graph_id": gid,
            "nodes": list(g.nodes.keys()),
            "entry_point": g.entry_point,
        }
        for gid, g in _registry.items()
    ]


def reset_graph_registry() -> None:
    _registry.clear()
