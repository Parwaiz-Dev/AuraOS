"""MCP Service — service-layer bridge for the MCP subsystem."""

from __future__ import annotations

from typing import Any

from app.mcp.models import MCPToolResult
from app.mcp.registry import get_mcp_registry


async def list_mcp_tools(category: str | None = None) -> list[dict[str, Any]]:
    registry = get_mcp_registry()
    return registry.discover(category)


async def execute_mcp_tool(
    tool_name: str,
    parameters: dict[str, Any],
    user_role: str = "ADMIN",
) -> dict[str, Any]:
    registry = get_mcp_registry()
    result = await registry.execute(tool_name, parameters, user_role)
    return result.model_dump(mode="json")


async def register_mcp_tool(
    name: str,
    description: str,
    category: str = "custom",
) -> dict[str, Any]:
    from app.mcp.tool_adapter import CustomTool
    tool = CustomTool(
        name=name,
        description=description,
        handler=lambda params: {"custom": True, "tool": name, **params},
    )
    registry = get_mcp_registry()
    registry.register(tool)
    return {"registered": True, "tool_name": name}


async def get_mcp_stats() -> dict[str, Any]:
    registry = get_mcp_registry()
    return registry.get_stats()


async def get_mcp_execution_log(limit: int = 50) -> list[dict[str, Any]]:
    registry = get_mcp_registry()
    return registry.get_execution_log(limit)
