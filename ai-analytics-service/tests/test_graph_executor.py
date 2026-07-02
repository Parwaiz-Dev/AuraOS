"""Tests for Graph Executor edge cases — Milestone 12."""

from __future__ import annotations

import asyncio

import pytest

from app.langgraph.graph_builder import GraphBuilder
from app.langgraph.graph_executor import GraphExecutor, reset_graph_executor
from app.langgraph.graph_nodes import GraphNode, ParallelNode
from app.langgraph.graph_state import GraphState, NodeResult
from app.self_healing.circuit_breaker import reset_circuit_breakers
from app.self_healing.metrics import reset_metrics_collector


@pytest.fixture(autouse=True)
def _reset():
    reset_graph_executor()
    reset_circuit_breakers()
    reset_metrics_collector()
    yield
    reset_graph_executor()
    reset_circuit_breakers()
    reset_metrics_collector()


class SuccessNode(GraphNode):
    name = "success"
    async def execute(self, state: GraphState) -> GraphState:
        state.set_result(self.name, NodeResult(node=self.name, status="success", data={"ok": True}))
        return state


class FailNode(GraphNode):
    name = "fail"
    async def execute(self, state: GraphState) -> GraphState:
        raise RuntimeError("intentional failure")


class SlowNode(GraphNode):
    name = "slow"
    timeout = 0.1
    async def execute(self, state: GraphState) -> GraphState:
        await asyncio.sleep(5)
        return state


class CounterNode(GraphNode):
    name = "counter"
    _count = 0
    async def execute(self, state: GraphState) -> GraphState:
        CounterNode._count += 1
        state.context["count"] = CounterNode._count
        state.set_result(self.name, NodeResult(
            node=self.name, status="success",
            data={"count": CounterNode._count},
        ))
        return state


class TestExecutorFailureHandling:
    @pytest.mark.asyncio
    async def test_node_failure_captured(self):
        graph = (
            GraphBuilder("fail_test")
            .add_node(FailNode())
            .set_entry_point("fail")
            .add_edge("fail", "END")
            .build()
        )
        executor = GraphExecutor()
        state = await executor.run(graph)
        result = state.get_result("fail")
        assert result is not None
        assert result.status == "failed"
        assert "intentional failure" in result.error

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        graph = (
            GraphBuilder("timeout_test")
            .add_node(SlowNode())
            .set_entry_point("slow")
            .add_edge("slow", "END")
            .build()
        )
        executor = GraphExecutor()
        state = await executor.run(graph, timeout=300)
        result = state.get_result("slow")
        assert result is not None
        assert result.status == "timeout"


class TestExecutorParallel:
    @pytest.mark.asyncio
    async def test_parallel_execution(self):
        class NodeA(GraphNode):
            name = "A"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(
                    node=self.name, status="success", data={"a": 1},
                ))
                state.context["a_result"] = 1
                return state

        class NodeB(GraphNode):
            name = "B"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(
                    node=self.name, status="success", data={"b": 2},
                ))
                state.context["b_result"] = 2
                return state

        parallel = ParallelNode("parallel", [NodeA(), NodeB()])

        graph = (
            GraphBuilder("parallel_test")
            .add_node(parallel)
            .set_entry_point("parallel")
            .add_edge("parallel", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.status == "completed"
        p_result = state.get_result("parallel")
        assert p_result is not None


class TestExecutorChaining:
    @pytest.mark.asyncio
    async def test_multi_node_chain(self):
        class Step1(GraphNode):
            name = "step1"
            async def execute(self, state: GraphState) -> GraphState:
                state.context["step1"] = True
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        class Step2(GraphNode):
            name = "step2"
            async def execute(self, state: GraphState) -> GraphState:
                state.context["step2"] = True
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        class Step3(GraphNode):
            name = "step3"
            async def execute(self, state: GraphState) -> GraphState:
                state.context["step3"] = True
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        graph = (
            GraphBuilder("chain_test")
            .add_node(Step1())
            .add_node(Step2())
            .add_node(Step3())
            .set_entry_point("step1")
            .add_edge("step1", "step2")
            .add_edge("step2", "step3")
            .add_edge("step3", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.status == "completed"
        assert state.context.get("step1") is True
        assert state.context.get("step2") is True
        assert state.context.get("step3") is True
        assert state.visited_nodes == ["step1", "step2", "step3"]

    @pytest.mark.asyncio
    async def test_missing_node_in_chain(self):
        class Exists(GraphNode):
            name = "exists"
            async def execute(self, state: GraphState) -> GraphState:
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        graph = (
            GraphBuilder("missing")
            .add_node(Exists())
            .set_entry_point("exists")
            .add_edge("exists", "nonexistent_node")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.status == "failed"
        assert any("not found" in e for e in state.errors)


class TestExecutorContextPropagation:
    @pytest.mark.asyncio
    async def test_context_flows_through_nodes(self):
        class WriterNode(GraphNode):
            name = "writer"
            async def execute(self, state: GraphState) -> GraphState:
                state.context["written"] = "hello"
                state.set_result(self.name, NodeResult(node=self.name, status="success"))
                return state

        class ReaderNode(GraphNode):
            name = "reader"
            async def execute(self, state: GraphState) -> GraphState:
                val = state.context.get("written", "")
                state.set_result(self.name, NodeResult(
                    node=self.name, status="success",
                    data={"read_value": val},
                ))
                return state

        graph = (
            GraphBuilder("ctx_test")
            .add_node(WriterNode())
            .add_node(ReaderNode())
            .set_entry_point("writer")
            .add_edge("writer", "reader")
            .add_edge("reader", "END")
            .build()
        )

        executor = GraphExecutor()
        state = await executor.run(graph)
        assert state.status == "completed"
        reader_result = state.get_result("reader")
        assert reader_result is not None
        assert reader_result.data["read_value"] == "hello"
