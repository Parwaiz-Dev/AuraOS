"""MCP Transport — communication layer for MCP client/server."""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


class MCPTransport:
    """In-process transport for MCP messages.

    In production, this would be replaced with HTTP/SSE/WebSocket transport.
    For AuraOS, we use in-process dispatch with the same interface.
    """

    def __init__(self) -> None:
        self._connected = False

    async def connect(self) -> None:
        self._connected = True
        logger.info("MCP transport connected")

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("MCP transport disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def send(self, message: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            from app.mcp.exceptions import MCPTransportError
            raise MCPTransportError("Transport not connected")

        method = message.get("method", "")
        params = message.get("params", {})

        if method == "tools/list":
            from app.mcp.registry import get_mcp_registry
            registry = get_mcp_registry()
            return {"tools": registry.list_tools()}

        elif method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})
            from app.mcp.registry import get_mcp_registry
            registry = get_mcp_registry()
            result = await registry.execute(
                tool_name, arguments,
                user_role=params.get("user_role", "ADMIN"),
            )
            return result.model_dump(mode="json")

        return {"error": f"Unknown method: {method}"}

    async def receive(self) -> dict[str, Any]:
        return {}
