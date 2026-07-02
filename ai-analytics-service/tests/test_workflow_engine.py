"""Tests for the WorkflowEngine — run, registry, step execution, error handling."""

from __future__ import annotations

from typing import Any

import pytest

from app.workflows.workflow import Workflow, WorkflowStep
from app.workflows.workflow_context import WorkflowContext
from app.workflows.workflow_engine import get_workflow_engine, reset_workflow_engine
from app.workflows.workflow_registry import (
    clear_registry,
    get_registered_ids,
    register_workflow,
)


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_workflow_engine()
    clear_registry()


class SuccessStep(WorkflowStep):
    name = "success_step"
    timeout_seconds = 5.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        return {"ok": True}


class FailStep(WorkflowStep):
    name = "fail_step"
    timeout_seconds = 5.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        raise RuntimeError("step failed")


class SlowStep(WorkflowStep):
    name = "slow_step"
    timeout_seconds = 0.1

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        import asyncio
        await asyncio.sleep(10)
        return {}


class ConditionalStep(WorkflowStep):
    name = "conditional_step"
    timeout_seconds = 5.0

    def should_skip(self, ctx: WorkflowContext) -> bool:
        return ctx.metadata.get("skip_conditional", False)

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        return {"conditional": True}


class RetryStep(WorkflowStep):
    name = "retry_step"
    timeout_seconds = 5.0
    retries = 2

    _attempt = 0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        RetryStep._attempt += 1
        if RetryStep._attempt < 3:
            raise RuntimeError("transient")
        return {"attempt": RetryStep._attempt}


class RollbackStep(WorkflowStep):
    name = "rollback_step"
    timeout_seconds = 5.0
    rolled_back = False

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        return {"data": "value"}

    async def rollback(self, ctx: WorkflowContext) -> None:
        RollbackStep.rolled_back = True


class SuccessWorkflow(Workflow):
    workflow_id = "test_success"
    name = "Test Success"
    timeout_seconds = 30.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(SuccessStep())


class FailWorkflow(Workflow):
    workflow_id = "test_fail"
    name = "Test Fail"
    timeout_seconds = 30.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(SuccessStep())
        self.add_step(FailStep())


class TimeoutWorkflow(Workflow):
    workflow_id = "test_timeout"
    name = "Test Timeout"
    timeout_seconds = 30.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(SlowStep())


@pytest.mark.asyncio
class TestWorkflowEngine:
    async def test_run_success_workflow(self) -> None:
        register_workflow(SuccessWorkflow)
        engine = get_workflow_engine()
        result = await engine.run("test_success", restaurant_id="r1")
        assert result.state == "SUCCESS"
        assert len(result.steps) == 1
        assert result.steps[0].status == "success"

    async def test_run_fail_workflow(self) -> None:
        register_workflow(FailWorkflow)
        engine = get_workflow_engine()
        result = await engine.run("test_fail", restaurant_id="r1")
        assert result.state in ("FAILED", "ROLLED_BACK")
        assert len(result.errors) > 0

    async def test_run_unknown_workflow(self) -> None:
        engine = get_workflow_engine()
        with pytest.raises(Exception, match="not found"):
            await engine.run("nonexistent")

    async def test_step_timeout(self) -> None:
        register_workflow(TimeoutWorkflow)
        engine = get_workflow_engine()
        result = await engine.run("test_timeout", restaurant_id="r1")
        assert result.state in ("FAILED", "ROLLED_BACK")

    async def test_list_available(self) -> None:
        register_workflow(SuccessWorkflow)
        engine = get_workflow_engine()
        available = engine.list_available()
        assert any(w["workflow_id"] == "test_success" for w in available)


@pytest.mark.asyncio
class TestWorkflowStepFeatures:
    async def test_conditional_skip(self) -> None:

        class CondWorkflow(Workflow):
            workflow_id = "test_cond"
            name = "Test Conditional"
            timeout_seconds = 30.0

            def __init__(self) -> None:
                super().__init__()
                self.add_step(ConditionalStep())
                self.add_step(SuccessStep())

        register_workflow(CondWorkflow)
        engine = get_workflow_engine()
        result = await engine.run(
            "test_cond",
            restaurant_id="r1",
            metadata={"skip_conditional": True},
        )
        assert result.state == "SUCCESS"
        assert result.steps[0].skipped is True
        assert result.steps[1].status == "success"

    async def test_retry_step(self) -> None:
        RetryStep._attempt = 0

        class RetryWorkflow(Workflow):
            workflow_id = "test_retry"
            name = "Test Retry"
            timeout_seconds = 30.0

            def __init__(self) -> None:
                super().__init__()
                self.add_step(RetryStep())

        register_workflow(RetryWorkflow)
        engine = get_workflow_engine()
        result = await engine.run("test_retry", restaurant_id="r1")
        assert result.state == "SUCCESS"
        assert result.steps[0].retries == 2

    async def test_rollback_on_failure(self) -> None:
        RollbackStep.rolled_back = False

        class RollbackWorkflow(Workflow):
            workflow_id = "test_rollback"
            name = "Test Rollback"
            timeout_seconds = 30.0

            def __init__(self) -> None:
                super().__init__()
                self.add_step(RollbackStep())
                self.add_step(FailStep())

        register_workflow(RollbackWorkflow)
        engine = get_workflow_engine()
        result = await engine.run("test_rollback", restaurant_id="r1")
        assert result.state == "ROLLED_BACK"
        assert RollbackStep.rolled_back is True

    async def test_parallel_steps(self) -> None:
        class ParallelWorkflow(Workflow):
            workflow_id = "test_parallel"
            name = "Test Parallel"
            timeout_seconds = 30.0

            def __init__(self) -> None:
                super().__init__()
                self.add_parallel_steps("group_a", [SuccessStep(), SuccessStep()])

        register_workflow(ParallelWorkflow)
        engine = get_workflow_engine()
        result = await engine.run("test_parallel", restaurant_id="r1")
        assert result.state == "SUCCESS"
        assert len(result.steps) == 2
