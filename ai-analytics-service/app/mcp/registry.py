"""MCP Registry — central catalog for tool discovery and lifecycle."""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

from app.mcp.models import MCPTool, MCPToolResult
from app.mcp.tool_adapter import BaseTool, get_builtin_tools

logger = logging.getLogger(__name__)


class MCPRegistry:
    """Registry for MCP tools — supports discovery, registration, and execution."""

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}
        self._definitions: dict[str, MCPTool] = {}
        self._execution_log: deque[dict[str, Any]] = deque(maxlen=500)
        self._stats = {
            "total_executions": 0,
            "successful": 0,
            "failed": 0,
        }

    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool
        self._definitions[tool.name] = tool.get_definition()
        logger.info("MCP tool registered: %s", tool.name)

    def unregister(self, tool_name: str) -> bool:
        if tool_name in self._tools:
            del self._tools[tool_name]
            self._definitions.pop(tool_name, None)
            return True
        return False

    def get_tool(self, tool_name: str) -> BaseTool | None:
        return self._tools.get(tool_name)

    def get_definition(self, tool_name: str) -> MCPTool | None:
        return self._definitions.get(tool_name)

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            defn.model_dump(mode="json")
            for defn in self._definitions.values()
        ]

    def discover(self, category: str | None = None) -> list[dict[str, Any]]:
        tools = self.list_tools()
        if category:
            tools = [t for t in tools if t.get("category") == category]
        return tools

    async def execute(
        self,
        tool_name: str,
        parameters: dict[str, Any],
        user_role: str = "ADMIN",
    ) -> MCPToolResult:
        self._stats["total_executions"] += 1

        tool = self.get_tool(tool_name)
        if tool is None:
            self._stats["failed"] += 1
            return MCPToolResult(
                tool_name=tool_name,
                success=False,
                error=f"Tool '{tool_name}' not found",
            )

        from app.mcp.permissions import get_permission_manager
        pm = get_permission_manager()
        if not pm.check_permission(tool_name, tool.required_permissions, user_role):
            self._stats["failed"] += 1
            return MCPToolResult(
                tool_name=tool_name,
                success=False,
                error=f"Permission denied for tool '{tool_name}'",
            )

        from app.self_healing.circuit_breaker import get_circuit_breaker
        cb = get_circuit_breaker(f"mcp:{tool_name}")
        if not cb.is_available:
            self._stats["failed"] += 1
            cb.record_rejection()
            return MCPToolResult(
                tool_name=tool_name,
                success=False,
                error=f"Circuit breaker open for tool '{tool_name}'",
            )

        result = await tool.safe_execute(parameters)

        if result.success:
            self._stats["successful"] += 1
            cb.record_success()
        else:
            self._stats["failed"] += 1
            cb.record_failure()

        from app.self_healing.metrics import get_metrics_collector
        collector = get_metrics_collector()
        collector.record_latency(f"mcp:{tool_name}", result.duration_ms)

        self._execution_log.appendleft({
            "tool": tool_name,
            "success": result.success,
            "duration_ms": result.duration_ms,
            "error": result.error,
        })

        return result

    def get_stats(self) -> dict[str, Any]:
        return {
            "registered_tools": len(self._tools),
            **self._stats,
            "recent_executions": len(self._execution_log),
        }

    def get_execution_log(self, limit: int = 50) -> list[dict[str, Any]]:
        return list(self._execution_log)[:limit]

    def register_builtins(self) -> None:
        for tool in get_builtin_tools():
            self.register(tool)

    def reset(self) -> None:
        self._tools.clear()
        self._definitions.clear()
        self._execution_log.clear()
        for key in self._stats:
            self._stats[key] = 0


_registry: MCPRegistry | None = None


def get_mcp_registry() -> MCPRegistry:
    global _registry
    if _registry is None:
        _registry = MCPRegistry()
        _registry.register_builtins()
    return _registry


def reset_mcp_registry() -> None:
    global _registry
    _registry = None
