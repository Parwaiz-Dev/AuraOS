"""Workflow execution context — shared state across steps."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class WorkflowContext(BaseModel):
    """Shared execution context passed through every step."""

    workflow_id: str = ""
    execution_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str = ""
    user_id: str = ""
    request_id: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    step_results: dict[str, Any] = Field(default_factory=dict)
    timestamps: dict[str, str] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    cancelled: bool = False

    def mark_start(self) -> None:
        self.timestamps["started_at"] = datetime.now(timezone.utc).isoformat()

    def mark_end(self) -> None:
        self.timestamps["completed_at"] = datetime.now(timezone.utc).isoformat()

    def set_step_result(self, step_name: str, data: Any) -> None:
        self.step_results[step_name] = data

    def get_step_result(self, step_name: str) -> Any:
        return self.step_results.get(step_name)

    def add_error(self, error: str) -> None:
        self.errors.append(error)
