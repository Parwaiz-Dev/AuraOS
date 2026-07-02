"""Workflow state machine."""

from __future__ import annotations

from enum import Enum


class WorkflowState(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    WAITING = "WAITING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    ROLLED_BACK = "ROLLED_BACK"
    TIMEOUT = "TIMEOUT"

    @property
    def is_terminal(self) -> bool:
        return self in (
            WorkflowState.SUCCESS,
            WorkflowState.FAILED,
            WorkflowState.CANCELLED,
            WorkflowState.ROLLED_BACK,
            WorkflowState.TIMEOUT,
        )


VALID_TRANSITIONS: dict[WorkflowState, set[WorkflowState]] = {
    WorkflowState.CREATED: {WorkflowState.RUNNING, WorkflowState.CANCELLED},
    WorkflowState.RUNNING: {
        WorkflowState.WAITING,
        WorkflowState.SUCCESS,
        WorkflowState.FAILED,
        WorkflowState.CANCELLED,
        WorkflowState.TIMEOUT,
    },
    WorkflowState.WAITING: {
        WorkflowState.RUNNING,
        WorkflowState.FAILED,
        WorkflowState.CANCELLED,
        WorkflowState.TIMEOUT,
    },
    WorkflowState.FAILED: {WorkflowState.ROLLED_BACK},
    WorkflowState.SUCCESS: set(),
    WorkflowState.CANCELLED: set(),
    WorkflowState.ROLLED_BACK: set(),
    WorkflowState.TIMEOUT: set(),
}


def can_transition(current: WorkflowState, target: WorkflowState) -> bool:
    return target in VALID_TRANSITIONS.get(current, set())
