"""Autonomy models — Pydantic v2 models for the autonomous AI engine."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ApprovalLevel(str, Enum):
    SAFE = "SAFE"
    OWNER_APPROVAL = "OWNER_APPROVAL"
    ADMIN_APPROVAL = "ADMIN_APPROVAL"


class ActionStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Observation(BaseModel):
    domain: str = ""
    metric: str = ""
    current_value: float = 0.0
    expected_value: float = 0.0
    deviation_pct: float = 0.0
    severity: str = "low"
    observed_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    details: dict[str, Any] = Field(default_factory=dict)


class Decision(BaseModel):
    decision_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str = ""
    observation: Observation | None = None
    action_name: str = ""
    confidence: float = 0.0
    risk: str = "LOW"
    reasoning_summary: str = ""
    alternative_actions: list[str] = Field(default_factory=list)
    expected_benefit: str = ""
    estimated_cost: str = "none"
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


class Plan(BaseModel):
    plan_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    decision_id: str = ""
    restaurant_id: str = ""
    steps: list[PlanStep] = Field(default_factory=list)
    status: str = "CREATED"
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


class PlanStep(BaseModel):
    name: str = ""
    action_name: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)
    approval_level: str = "SAFE"
    status: str = "PENDING"
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


# Fix forward reference
Plan.model_rebuild()


class ApprovalRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str = ""
    action_name: str = ""
    decision_id: str = ""
    plan_id: str = ""
    approval_level: str = "OWNER_APPROVAL"
    status: str = "PENDING"
    reason: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    resolved_at: str | None = None
    resolved_by: str | None = None


class ActionRecord(BaseModel):
    record_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str = ""
    action_name: str = ""
    decision_id: str = ""
    workflow_name: str = ""
    confidence: float = 0.0
    risk: str = "LOW"
    approval_level: str = "SAFE"
    approval_status: str = "APPROVED"
    status: str = "PENDING"
    reason: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    duration_ms: float = 0.0
    started_at: str = ""
    completed_at: str = ""


class AutonomyStatus(BaseModel):
    enabled: bool = True
    total_decisions: int = 0
    total_actions: int = 0
    pending_approvals: int = 0
    auto_executed: int = 0
    success_rate: float = 0.0
    registered_actions: int = 0
