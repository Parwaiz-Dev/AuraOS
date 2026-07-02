"""Pydantic models for workflow persistence and API serialization."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WorkflowStepDef(BaseModel):
    """Definition of a single workflow step."""

    name: str
    handler: str = ""
    timeout_seconds: float = 300.0
    retries: int = 0
    condition: str | None = None
    parallel_group: str | None = None
    depends_on: list[str] = Field(default_factory=list)


class WorkflowDef(BaseModel):
    """Definition of a complete workflow."""

    workflow_id: str
    name: str
    description: str = ""
    steps: list[WorkflowStepDef] = Field(default_factory=list)
    timeout_seconds: float = 600.0
    retries: int = 0


class WorkflowExecution(BaseModel):
    """Persisted record of a workflow execution."""

    workflow_id: str
    execution_id: str
    workflow_name: str = ""
    restaurant_id: str = ""
    user_id: str = ""
    status: str = "CREATED"
    steps: list[dict[str, Any]] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    retries: int = 0
    duration_ms: float = 0.0
    started_at: str = ""
    completed_at: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
