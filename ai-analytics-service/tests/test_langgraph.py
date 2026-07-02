"""Tests for LangGraph Orchestrator — Milestone 12."""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.langgraph.exceptions import GraphBuildError
from app.langgraph.graph import get_graph, list_graphs, register_default_graphs, reset_graph_registry
from app.langgraph.graph_builder import GraphBuilder, GraphDefinition
from app.langgraph.graph_executor import GraphExecutor, get_graph_executor, reset_graph_executor
from app.langgraph.graph_memory import GraphMemory, get_graph_memory, reset_graph_memory
from app.langgraph.graph_nodes import (
    AgentNode,
    DecisionNode,
    GraphNode,
    HumanApprovalNode,
    MemoryNode,
    ParallelNode,
)
from app.langgraph.graph_router import GraphRouter
from app.langgraph.graph_state import GraphState, NodeResult
from app.langgraph.graph_visualizer import to_mermaid, visualize_graph
from app.self_healing.circuit_breaker import reset_circuit_breakers
from app.self_healing.metrics import reset_metrics_collector


@pytest.fixture(autouse=True)
def _reset():
    reset_graph_executor()
    reset_graph_memory()
    reset_graph_registry()
    reset_circuit_breakers()
    reset_metrics_collector()
    yield
    reset_graph_executor()
    reset_graph_memory()
    reset_graph_registry()
    reset_circuit_breakers()
    reset_metrics_collector()


class TestGraphState:
    def test_initial_state(self):
        state = GraphState()
        assert state.status == "pending"
        assert state.visited_nodes == []
        assert state.iteration == 0

    def test_mark_visited(self):
        state = GraphState()
        state.mark_visited("node1")
        state.mark_visited("node2")
        assert state.current_node == "node2"
        assert state.visited_nodes == ["node1", "node2"]

    def test_duplicate_visit(self):
        state = GraphState()
        state.mark_visited("node1")
        state.mark_visited("node1")
        assert state.visited_nodes == ["node1"]

    def test_set_and_get_result(self):
        state = GraphState()
        result = NodeResult(node="test", status="success", data={"key": "value"})
        state.set_result("test", result)
        r = state.get_result("test")
        assert r is not None
        assert r.data == {"key": "value"}

    def test_iteration_limit(self):
        state = GraphState(max_iterations=3)
        assert state.check_iteration_limit()
        assert state.check_iteration_limit()
        assert state.check_iteration_limit()
        assert not state.check_iteration_limit()

    def test_is_complete(self):
        state = GraphState()
        assert not state.is_complete()
        state.status = "completed"
        assert state.is_complete()

    def test_add_error(self):
        state = GraphState()
        state.add_error("something broke")
        assert len(state.errors) == 1


class TestGraphRouter:
    def test_direct_edge(self):
        router = GraphRouter()
        router.add_edge("A", "B")
        state = GraphState()
        assert router.get_next("A", state) == "B"

    def test_conditional_edge(self):
        router = GraphRouter()
        router.add_conditional_edge(
            "decision",
            {"yes": "accept", "no": "reject", "default": "fallback"},
            lambda state: "yes" if state.query == "approve" else "no",
        )
        state = GraphState(query="approve")
        assert router.get_next("decision", state) == "accept"
        state2 = GraphState(query="deny")
        assert router.get_next("decision", state2) == "reject"

    def test_missing_route_returns_empty(self):
        router = GraphRouter()
        state = GraphState()
        assert router.get_next("unknown", state) == ""

    def test_has_route(self):
        router = GraphRouter()
        router.add_edge("A", "B")
        assert router.has_route("A")
        assert not router.has_route("Z")

    def test_get_all_edges(self):
        router = GraphRouter()
        router.add_edge("A", "B")
        edges = router.get_all_edges()
        assert "A" in edges
        assert edges["A"]["type"] == "direct"


class TestGraphBuilder:
    def test_build_simple_graph(self):
        class TestNode(GraphNode):
            name = "test_node"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        builder = (
            GraphBuilder("simple")
            .add_node(TestNode())
            .set_entry_point("test_node")
            .add_edge("test_node", "END")
        )
        graph = builder.build()
        assert graph.graph_id == "simple"
        assert graph.entry_point == "test_node"
        assert "test_node" in graph.nodes

    def test_build_fails_without_entry_point(self):
        class DummyNode(GraphNode):
            name = "dummy"
            async def execute(self, state: GraphState) -> GraphState:
                return state

        builder = GraphBuilder("fail").add_node(DummyNode())
        with pytest.raises(GraphBuildError, match="Entry point not set"):
            builder.build()

    def test_build_fails_with_invalid_entry_point(self):
        builder = GraphBuilder("fail").set_entry_point("nonexistent")
        with pytest.raises(GraphBuildError, match="not found"):
            builder.build()

    def test_add_agent_node(self):
        builder = GraphBuilder("test")
        builder.add_agent_node("revenue_agent")
        builder.set_entry_point("agent:revenue_agent")
        graph = builder.build()
        assert "agent:revenue_agent" in graph.nodes

    def test_topology(self):
        class N(GraphNode):
            name = "n"
            async def execute(self, s):
                return s

        builder = (
            GraphBuilder("topo")
            .add_node(N())
            .set_entry_point("n")
            .add_edge("n", "END")
        )
        graph = builder.build()
        topo = graph.get_topology()
        assert topo["graph_id"] == "topo"
        assert "n" in topo["nodes"]


class TestGraphExecutor:
    @pytest.mark.asyncio
    async def test_run_simple_graph(self):
        class SuccessNode(GraphNode):
            name = "success"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(
                    node=self.name, status="success", data={"ok": True},
                ))
                return state

        graph = (
            GraphBuilder("test")
            .add_node(SuccessNode())
            .set_entry_point("success")
            .add_edge("success", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph, restaurant_id="r1", query="test")
        assert state.status == "completed"
        assert state.get_result("success") is not None
        assert state.get_result("success").data["ok"] is True

    @pytest.mark.asyncio
    async def test_run_with_decision(self):
        class NodeA(GraphNode):
            name = "A"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        class NodeB(GraphNode):
            name = "B"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        graph = (
            GraphBuilder("decision_test")
            .add_node(NodeA())
            .add_node(NodeB())
            .add_decision_node("decide", lambda s: "go_b")
            .set_entry_point("decide")
            .add_conditional_edge("decide", {
                "go_a": "A",
                "go_b": "B",
            }, lambda s: "go_b")
            .add_edge("A", "END")
            .add_edge("B", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.status == "completed"
        assert "B" in state.visited_nodes

    @pytest.mark.asyncio
    async def test_iteration_limit(self):
        class LoopNode(GraphNode):
            name = "loop"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        graph = (
            GraphBuilder("loop_test")
            .add_node(LoopNode())
            .set_entry_point("loop")
            .add_edge("loop", "loop")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.status == "failed"
        assert any("iteration" in e.lower() for e in state.errors)

    @pytest.mark.asyncio
    async def test_human_approval_pauses(self):
        graph = (
            GraphBuilder("approval_test")
            .add_approval_node("approve")
            .set_entry_point("approve")
            .add_edge("approve", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.pending_approval is True
        assert state.status == "awaiting_approval"

    @pytest.mark.asyncio
    async def test_resume_after_approval(self):
        class FinalNode(GraphNode):
            name = "final"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(
                    node=self.name, status="success", data={"done": True},
                ))
                return state

        graph = (
            GraphBuilder("resume_test")
            .add_approval_node("approve")
            .add_node(FinalNode())
            .set_entry_point("approve")
            .add_edge("approve", "final")
            .add_edge("final", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.pending_approval
        resumed = await executor.resume(graph, state, approved=True)
        assert resumed.status == "completed"
        assert resumed.get_result("final") is not None

    @pytest.mark.asyncio
    async def test_resume_denied(self):
        graph = (
            GraphBuilder("deny_test")
            .add_approval_node("approve")
            .set_entry_point("approve")
            .add_edge("approve", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        denied = await executor.resume(graph, state, approved=False)
        assert denied.status == "cancelled"

    @pytest.mark.asyncio
    async def test_stats_tracking(self):
        class OkNode(GraphNode):
            name = "ok"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        graph = (
            GraphBuilder("stats_test")
            .add_node(OkNode())
            .set_entry_point("ok")
            .add_edge("ok", "END")
            .build()
        )

        executor = GraphExecutor()
        await executor.run(graph)
        stats = executor.get_stats()
        assert stats["total_runs"] == 1
        assert stats["successful"] == 1

    @pytest.mark.asyncio
    async def test_history(self):
        class OkNode(GraphNode):
            name = "ok"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        graph = (
            GraphBuilder("hist")
            .add_node(OkNode())
            .set_entry_point("ok")
            .add_edge("ok", "END")
            .build()
        )

        executor = GraphExecutor()
        await executor.run(graph)
        history = executor.get_history()
        assert len(history) == 1
        assert history[0]["graph_id"] == "hist"

    @pytest.mark.asyncio
    async def test_singleton(self):
        e1 = get_graph_executor()
        e2 = get_graph_executor()
        assert e1 is e2


class TestGraphMemory:
    @pytest.mark.asyncio
    async def test_conversation_memory(self):
        mem = GraphMemory()
        await mem.add_conversation("r1", "user", "hello")
        await mem.add_conversation("r1", "assistant", "hi there")
        conv = await mem.get_conversation("r1")
        assert len(conv) >= 2

    @pytest.mark.asyncio
    async def test_agent_memory(self):
        mem = GraphMemory()
        await mem.save_agent_state("agent1", {"status": "ok"})
        state = await mem.load_agent_state("agent1")
        assert state.get("status") == "ok"

    @pytest.mark.asyncio
    async def test_workflow_memory(self):
        mem = GraphMemory()
        await mem.save_workflow_state("wf1", {"step": 3})
        state = await mem.load_workflow_state("wf1")
        assert state.get("step") == 3

    @pytest.mark.asyncio
    async def test_context_memory(self):
        mem = GraphMemory()
        await mem.save_context("r1", "g1", {"key": "value"})
        ctx = await mem.load_context("r1", "g1")
        assert ctx.get("key") == "value"

    @pytest.mark.asyncio
    async def test_execution_history(self):
        mem = GraphMemory()
        await mem.record_execution("r1", {"graph": "test", "status": "done"})
        history = await mem.get_execution_history("r1")
        assert len(history) >= 1

    @pytest.mark.asyncio
    async def test_reset(self):
        mem = GraphMemory()
        await mem.add_conversation("r1", "user", "test")
        mem.reset()
        conv = await mem.get_conversation("r1")
        assert conv == []

    @pytest.mark.asyncio
    async def test_singleton(self):
        m1 = get_graph_memory()
        m2 = get_graph_memory()
        assert m1 is m2


class TestPrebuiltGraphs:
    def test_register_default_graphs(self):
        register_default_graphs()
        graphs = list_graphs()
        ids = [g["graph_id"] for g in graphs]
        assert "analytics" in ids
        assert "autonomous" in ids
        assert "self_healing" in ids

    def test_get_graph(self):
        register_default_graphs()
        g = get_graph("analytics")
        assert g is not None
        assert g.graph_id == "analytics"

    def test_get_nonexistent(self):
        register_default_graphs()
        g = get_graph("nonexistent")
        assert g is None


class TestGraphVisualizer:
    def test_visualize(self):
        register_default_graphs()
        g = get_graph("analytics")
        topo = visualize_graph(g)
        assert "graph_id" in topo
        assert "nodes" in topo

    def test_mermaid(self):
        register_default_graphs()
        g = get_graph("analytics")
        mermaid = to_mermaid(g)
        assert "graph TD" in mermaid
