"""Multi-Agent models — Pydantic v2 models for the agent system."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    BUSY = "BUSY"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


class MessageType(str, Enum):
    REQUEST = "REQUEST"
    RESPONSE = "RESPONSE"
    BROADCAST = "BROADCAST"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AgentInfo(BaseModel):
    agent_id: str = ""
    name: str = ""
    description: str = ""
    capabilities: list[str] = Field(default_factory=list)
    supported_events: list[str] = Field(default_factory=list)
    priority: int = 5
    status: str = "IDLE"
    health: str = "healthy"
    tasks_completed: int = 0
    tasks_failed: int = 0
    avg_response_ms: float = 0.0
    restart_count: int = 0


class AgentMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_type: str = "REQUEST"
    from_agent: str = ""
    to_agent: str = ""
    action: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = 5
    timeout_seconds: float = 60.0
    retry_count: int = 0
    max_retries: int = 2
    acknowledged: bool = False
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    response: dict[str, Any] | None = None


class AgentTask(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request: str = ""
    agent_id: str = ""
    restaurant_id: str = ""
    status: str = "PENDING"
    subtasks: list[SubTask] = Field(default_factory=list)
    result: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    duration_ms: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str = ""


class SubTask(BaseModel):
    subtask_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str = ""
    action: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)
    status: str = "PENDING"
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    duration_ms: float = 0.0


# Fix forward reference
AgentTask.model_rebuild()


class AgentMetrics(BaseModel):
    total_agents: int = 0
    healthy: int = 0
    busy: int = 0
    failed: int = 0
    stopped: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    avg_response_ms: float = 0.0
    total_messages: int = 0
    total_restarts: int = 0
