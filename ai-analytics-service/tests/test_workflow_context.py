"""Tests for WorkflowContext."""

from __future__ import annotations

import pytest

from app.workflows.workflow_context import WorkflowContext


class TestWorkflowContext:
    def test_defaults(self) -> None:
        ctx = WorkflowContext(restaurant_id="r1", user_id="u1")
        assert ctx.restaurant_id == "r1"
        assert ctx.user_id == "u1"
        assert ctx.execution_id
        assert ctx.step_results == {}
        assert ctx.errors == []
        assert ctx.cancelled is False

    def test_mark_start_end(self) -> None:
        ctx = WorkflowContext()
        ctx.mark_start()
        assert "started_at" in ctx.timestamps
        ctx.mark_end()
        assert "completed_at" in ctx.timestamps

    def test_step_results(self) -> None:
        ctx = WorkflowContext()
        ctx.set_step_result("collect_data", {"dashboard": {"revenue": 1000}})
        result = ctx.get_step_result("collect_data")
        assert result["dashboard"]["revenue"] == 1000

    def test_missing_step_result(self) -> None:
        ctx = WorkflowContext()
        assert ctx.get_step_result("nonexistent") is None

    def test_add_error(self) -> None:
        ctx = WorkflowContext()
        ctx.add_error("Something went wrong")
        ctx.add_error("Another error")
        assert len(ctx.errors) == 2
        assert "Something went wrong" in ctx.errors

    def test_metadata(self) -> None:
        ctx = WorkflowContext(metadata={"trigger": "OrderCompleted", "order_id": "o1"})
        assert ctx.metadata["trigger"] == "OrderCompleted"

    def test_serialization(self) -> None:
        ctx = WorkflowContext(
            restaurant_id="r1",
            user_id="u1",
            metadata={"key": "value"},
        )
        ctx.set_step_result("s1", {"data": 42})
        data = ctx.model_dump(mode="json")
        restored = WorkflowContext.model_validate(data)
        assert restored.restaurant_id == "r1"
        assert restored.get_step_result("s1")["data"] == 42

    def test_cancellation_flag(self) -> None:
        ctx = WorkflowContext()
        assert not ctx.cancelled
        ctx.cancelled = True
        assert ctx.cancelled
