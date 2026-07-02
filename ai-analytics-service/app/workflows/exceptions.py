"""Workflow exceptions."""

from __future__ import annotations


class WorkflowError(Exception):
    """Base exception for workflow errors."""


class WorkflowNotFoundError(WorkflowError):
    """Raised when a workflow definition is not found."""


class WorkflowExecutionError(WorkflowError):
    """Raised when a workflow execution fails."""


class StepExecutionError(WorkflowError):
    """Raised when a workflow step fails."""

    def __init__(self, step_name: str, message: str) -> None:
        self.step_name = step_name
        super().__init__(f"Step '{step_name}' failed: {message}")


class WorkflowTimeoutError(WorkflowError):
    """Raised when a workflow exceeds its timeout."""


class WorkflowCancelledError(WorkflowError):
    """Raised when a workflow is cancelled."""
