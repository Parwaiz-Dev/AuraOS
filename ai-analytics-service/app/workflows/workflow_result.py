"""Workflow execution result."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class StepResult(BaseModel):
    """Result of a single workflow step."""

    step_name: str
    status: str = "pending"
    data: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    duration_ms: float = 0.0
    retries: int = 0
    skipped: bool = False


class WorkflowResult(BaseModel):
    """Final result of a workflow execution."""

    workflow_id: str
    execution_id: str
    workflow_name: str
    state: str = "CREATED"
    steps: list[StepResult] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    duration_ms: float = 0.0
    started_at: str = ""
    completed_at: str = ""
    restaurant_id: str = ""
