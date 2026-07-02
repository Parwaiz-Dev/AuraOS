"""MCP Models — Pydantic v2 models for MCP tools and results."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ToolCategory(str, Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    CUSTOM = "custom"


class ToolPermission(str, Enum):
    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    ADMIN = "admin"


class MCPToolParameter(BaseModel):
    name: str
    type: str = "string"
    description: str = ""
    required: bool = False
    default: Any = None


class MCPTool(BaseModel):
    tool_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    category: str = "internal"
    version: str = "1.0.0"
    parameters: list[MCPToolParameter] = Field(default_factory=list)
    required_permissions: list[str] = Field(default_factory=lambda: ["read"])
    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)
    registered_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


class MCPToolResult(BaseModel):
    tool_name: str
    execution_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    success: bool = True
    data: dict[str, Any] = Field(default_factory=dict)
    error: str = ""
    duration_ms: float = 0.0
    executed_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


class MCPRequest(BaseModel):
    tool_name: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    timeout: float = 30.0


class MCPResponse(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tool_name: str = ""
    success: bool = True
    result: dict[str, Any] = Field(default_factory=dict)
    error: str = ""
    duration_ms: float = 0.0
