"""MCP Tool Adapter — wraps existing AuraOS tools into MCP-compatible interfaces."""

from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Any

from app.mcp.models import MCPTool, MCPToolResult

logger = logging.getLogger(__name__)


class BaseTool(ABC):
    """Base adapter for MCP tools."""

    name: str = "base_tool"
    description: str = ""
    category: str = "internal"
    required_permissions: list[str] = ["read"]

    @abstractmethod
    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        ...

    def get_definition(self) -> MCPTool:
        return MCPTool(
            name=self.name,
            description=self.description,
            category=self.category,
            required_permissions=self.required_permissions,
        )

    async def safe_execute(self, parameters: dict[str, Any]) -> MCPToolResult:
        t0 = time.monotonic()
        try:
            data = await asyncio.wait_for(
                self.execute(parameters),
                timeout=60.0,
            )
            return MCPToolResult(
                tool_name=self.name,
                success=True,
                data=data,
                duration_ms=round((time.monotonic() - t0) * 1000, 2),
            )
        except asyncio.TimeoutError:
            return MCPToolResult(
                tool_name=self.name,
                success=False,
                error="Tool execution timed out",
                duration_ms=round((time.monotonic() - t0) * 1000, 2),
            )
        except Exception as exc:
            return MCPToolResult(
                tool_name=self.name,
                success=False,
                error=str(exc),
                duration_ms=round((time.monotonic() - t0) * 1000, 2),
            )


# ── Built-in tool adapters wrapping existing AuraOS services ────────────────


class WeatherTool(BaseTool):
    name = "weather"
    description = "Fetch weather data for restaurant planning"
    category = "external"
    required_permissions = ["read"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        location = parameters.get("location", "unknown")
        return {
            "location": location,
            "source": "weather_api",
            "note": "Configure WEATHER_API_KEY for live data",
            "conditions": "clear",
            "temperature_c": 25.0,
            "humidity_pct": 60,
        }


class CalendarTool(BaseTool):
    name = "calendar"
    description = "Manage restaurant events and reservations calendar"
    category = "external"
    required_permissions = ["read", "write"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        action = parameters.get("action", "list")
        return {"action": action, "source": "calendar", "events": []}


class EmailTool(BaseTool):
    name = "email"
    description = "Send email notifications"
    category = "external"
    required_permissions = ["execute"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        to = parameters.get("to", "")
        subject = parameters.get("subject", "")
        return {"sent": bool(to and subject), "to": to, "subject": subject}


class WebhookTool(BaseTool):
    name = "webhook"
    description = "Send or receive webhook calls"
    category = "external"
    required_permissions = ["execute"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        url = parameters.get("url", "")
        method = parameters.get("method", "POST")
        return {"url": url, "method": method, "status": "queued"}


class FilesystemTool(BaseTool):
    name = "filesystem"
    description = "Read files from the data directory"
    category = "internal"
    required_permissions = ["read"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        path = parameters.get("path", "")
        return {"path": path, "exists": False, "note": "Sandboxed to data directory"}


class HttpTool(BaseTool):
    name = "http"
    description = "Make HTTP requests to external APIs"
    category = "external"
    required_permissions = ["execute"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        url = parameters.get("url", "")
        method = parameters.get("method", "GET")
        return {"url": url, "method": method, "status": "configured"}


class DatabaseQueryTool(BaseTool):
    name = "database_query"
    description = "Execute read-only database queries"
    category = "internal"
    required_permissions = ["read"]

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        restaurant_id = parameters.get("restaurant_id", "")
        query_type = parameters.get("query_type", "summary")

        if not restaurant_id:
            return {"error": "restaurant_id required"}

        try:
            from app.agents.base_agent import agent_session
            from sqlalchemy import text

            async with agent_session() as session:
                if query_type == "order_count":
                    result = await session.execute(
                        text("SELECT COUNT(*) as cnt FROM orders WHERE restaurant_id = :rid"),
                        {"rid": restaurant_id},
                    )
                    row = result.fetchone()
                    return {"query_type": query_type, "count": row[0] if row else 0}
                return {"query_type": query_type, "note": "Supported: order_count"}
        except Exception as exc:
            return {"error": str(exc), "query_type": query_type}


class CustomTool(BaseTool):
    """User-defined custom tool."""

    category = "custom"
    required_permissions = ["execute"]

    def __init__(self, name: str, description: str, handler: Any) -> None:
        self.name = name
        self.description = description
        self._handler = handler

    async def execute(self, parameters: dict[str, Any]) -> dict[str, Any]:
        result = self._handler(parameters)
        if asyncio.iscoroutine(result):
            result = await result
        if isinstance(result, dict):
            return result
        return {"result": result}


def get_builtin_tools() -> list[BaseTool]:
    return [
        WeatherTool(),
        CalendarTool(),
        EmailTool(),
        WebhookTool(),
        FilesystemTool(),
        HttpTool(),
        DatabaseQueryTool(),
    ]
