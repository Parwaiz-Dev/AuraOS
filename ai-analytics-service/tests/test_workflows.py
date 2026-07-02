"""Tests for workflow definitions, state machine, and models."""

from __future__ import annotations

import pytest

from app.workflows.models import WorkflowDef, WorkflowExecution, WorkflowStepDef
from app.workflows.workflow_context import WorkflowContext
from app.workflows.workflow_result import StepResult, WorkflowResult
from app.workflows.workflow_state import WorkflowState, can_transition


class TestWorkflowState:
    def test_all_states_exist(self) -> None:
        states = [s.value for s in WorkflowState]
        assert "CREATED" in states
        assert "RUNNING" in states
        assert "SUCCESS" in states
        assert "FAILED" in states
        assert "CANCELLED" in states
        assert "ROLLED_BACK" in states
        assert "TIMEOUT" in states
        assert "WAITING" in states

    def test_terminal_states(self) -> None:
        assert WorkflowState.SUCCESS.is_terminal
        assert WorkflowState.FAILED.is_terminal
        assert WorkflowState.CANCELLED.is_terminal
        assert WorkflowState.ROLLED_BACK.is_terminal
        assert WorkflowState.TIMEOUT.is_terminal
        assert not WorkflowState.CREATED.is_terminal
        assert not WorkflowState.RUNNING.is_terminal

    def test_valid_transitions(self) -> None:
        assert can_transition(WorkflowState.CREATED, WorkflowState.RUNNING)
        assert can_transition(WorkflowState.CREATED, WorkflowState.CANCELLED)
        assert can_transition(WorkflowState.RUNNING, WorkflowState.SUCCESS)
        assert can_transition(WorkflowState.RUNNING, WorkflowState.FAILED)
        assert can_transition(WorkflowState.RUNNING, WorkflowState.CANCELLED)
        assert can_transition(WorkflowState.RUNNING, WorkflowState.TIMEOUT)
        assert can_transition(WorkflowState.FAILED, WorkflowState.ROLLED_BACK)

    def test_invalid_transitions(self) -> None:
        assert not can_transition(WorkflowState.SUCCESS, WorkflowState.RUNNING)
        assert not can_transition(WorkflowState.CANCELLED, WorkflowState.RUNNING)
        assert not can_transition(WorkflowState.CREATED, WorkflowState.SUCCESS)


class TestWorkflowModels:
    def test_step_def(self) -> None:
        step = WorkflowStepDef(name="collect_data", handler="collect_data")
        assert step.timeout_seconds == 300.0
        assert step.retries == 0

    def test_workflow_def(self) -> None:
        wf = WorkflowDef(
            workflow_id="test",
            name="Test Workflow",
            steps=[WorkflowStepDef(name="s1")],
        )
        assert len(wf.steps) == 1

    def test_workflow_execution(self) -> None:
        ex = WorkflowExecution(
            workflow_id="daily_analytics",
            execution_id="exec-1",
            status="SUCCESS",
        )
        assert ex.status == "SUCCESS"

    def test_step_result(self) -> None:
        sr = StepResult(step_name="collect_data", status="success", duration_ms=123.4)
        assert sr.step_name == "collect_data"
        assert sr.duration_ms == 123.4

    def test_workflow_result(self) -> None:
        wr = WorkflowResult(
            workflow_id="test",
            execution_id="exec-1",
            workflow_name="Test",
            state="SUCCESS",
        )
        assert wr.state == "SUCCESS"


class TestWorkflowResultSerialization:
    def test_roundtrip(self) -> None:
        wr = WorkflowResult(
            workflow_id="wf1",
            execution_id="e1",
            workflow_name="Test",
            state="SUCCESS",
            steps=[StepResult(step_name="s1", status="success", data={"key": "val"})],
        )
        data = wr.model_dump(mode="json")
        restored = WorkflowResult.model_validate(data)
        assert restored.execution_id == "e1"
        assert len(restored.steps) == 1
