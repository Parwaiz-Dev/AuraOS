"""MCP Server — exposes AuraOS tools via MCP protocol."""

from __future__ import annotations

import logging
from typing import Any

from app.mcp.transport import MCPTransport

logger = logging.getLogger(__name__)


class MCPServer:
    """MCP Server implementation for AuraOS.

    Exposes all registered MCP tools through a transport-agnostic interface.
    """

    def __init__(self) -> None:
        self._transport = MCPTransport()
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        await self._transport.connect()
        self._running = True
        logger.info("MCP Server started")

    async def stop(self) -> None:
        await self._transport.disconnect()
        self._running = False
        logger.info("MCP Server stopped")

    async def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        if not self._running:
            return {"error": "Server not running"}
        return await self._transport.send(request)

    async def list_tools(self) -> list[dict[str, Any]]:
        response = await self.handle_request({"method": "tools/list"})
        return response.get("tools", [])

    async def execute_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        user_role: str = "ADMIN",
    ) -> dict[str, Any]:
        response = await self.handle_request({
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
                "user_role": user_role,
            },
        })
        return response

    def get_status(self) -> dict[str, Any]:
        from app.mcp.registry import get_mcp_registry
        registry = get_mcp_registry()
        return {
            "running": self._running,
            "transport_connected": self._transport.is_connected,
            "registered_tools": len(registry.list_tools()),
            "stats": registry.get_stats(),
        }


_server: MCPServer | None = None


def get_mcp_server() -> MCPServer:
    global _server
    if _server is None:
        _server = MCPServer()
    return _server


def reset_mcp_server() -> None:
    global _server
    _server = None
