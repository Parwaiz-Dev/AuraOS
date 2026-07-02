"""Graph Visualizer — produces topology representations of graph definitions."""

from __future__ import annotations

from typing import Any

from app.langgraph.graph_builder import GraphDefinition


def visualize_graph(graph: GraphDefinition) -> dict[str, Any]:
    """Return a JSON-serializable topology of the graph."""
    return graph.get_topology()


def to_mermaid(graph: GraphDefinition) -> str:
    """Generate a Mermaid flowchart from the graph definition."""
    lines = ["graph TD"]
    edges = graph.router.get_all_edges()

    for node_name in graph.nodes:
        label = node_name.replace(":", "_")
        lines.append(f"    {label}[{node_name}]")

    lines.append("    END_NODE[END]")

    for src, info in edges.items():
        src_label = src.replace(":", "_")
        if info["type"] == "direct":
            dst = info["destination"]
            dst_label = dst.replace(":", "_") if dst != "END" else "END_NODE"
            lines.append(f"    {src_label} --> {dst_label}")
        else:
            for key, dst in info["destinations"].items():
                dst_label = dst.replace(":", "_") if dst != "END" else "END_NODE"
                lines.append(f"    {src_label} -->|{key}| {dst_label}")

    if graph.entry_point:
        ep = graph.entry_point.replace(":", "_")
        lines.append(f"    START(( )) --> {ep}")

    return "\n".join(lines)
