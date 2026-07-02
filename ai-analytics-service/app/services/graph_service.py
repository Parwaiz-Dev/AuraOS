"""Graph Service — service-layer bridge for the LangGraph subsystem."""

from __future__ import annotations

from typing import Any

from app.langgraph.graph import get_graph, list_graphs, register_graph
from app.langgraph.graph_executor import get_graph_executor
from app.langgraph.graph_state import GraphState


async def list_available_graphs() -> list[dict[str, Any]]:
    return list_graphs()


async def get_graph_status() -> dict[str, Any]:
    executor = get_graph_executor()
    stats = executor.get_stats()
    graphs = list_graphs()
    return {
        "available_graphs": len(graphs),
        "graphs": graphs,
        "execution_stats": stats,
    }


async def run_graph(
    graph_id: str,
    *,
    restaurant_id: str = "",
    user_id: str = "",
    query: str = "",
    context: dict[str, Any] | None = None,
    timeout: float = 300.0,
) -> dict[str, Any]:
    graph = get_graph(graph_id)
    if graph is None:
        return {"error": f"Graph '{graph_id}' not found"}

    executor = get_graph_executor()
    state = await executor.run(
        graph,
        restaurant_id=restaurant_id,
        user_id=user_id,
        query=query,
        context=context,
        timeout=timeout,
    )
    return _serialize_state(state)


async def get_graph_history(limit: int = 50) -> list[dict[str, Any]]:
    executor = get_graph_executor()
    return executor.get_history(limit)


async def get_graph_topology(graph_id: str) -> dict[str, Any]:
    graph = get_graph(graph_id)
    if graph is None:
        return {"error": f"Graph '{graph_id}' not found"}
    return graph.get_topology()


async def get_graph_visualization(graph_id: str) -> dict[str, Any]:
    graph = get_graph(graph_id)
    if graph is None:
        return {"error": f"Graph '{graph_id}' not found"}

    from app.langgraph.graph_visualizer import to_mermaid, visualize_graph
    return {
        "topology": visualize_graph(graph),
        "mermaid": to_mermaid(graph),
    }


def _serialize_state(state: GraphState) -> dict[str, Any]:
    data = state.model_dump(mode="json")
    node_results = {}
    for name, nr in state.node_results.items():
        node_results[name] = nr.model_dump(mode="json")
    data["node_results"] = node_results
    return data
