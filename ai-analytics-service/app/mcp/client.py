"""MCP Client — connects to MCP servers and invokes tools."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.mcp.transport import MCPTransport

logger = logging.getLogger(__name__)


class MCPClient:
    """MCP Client for connecting to external or local MCP servers."""

    def __init__(self, server_url: str = "local") -> None:
        self._server_url = server_url
        self._transport = MCPTransport()
        self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        await self._transport.connect()
        self._connected = True
        logger.info("MCP Client connected to %s", self._server_url)

    async def disconnect(self) -> None:
        await self._transport.disconnect()
        self._connected = False
        logger.info("MCP Client disconnected")

    async def list_tools(self) -> list[dict[str, Any]]:
        if not self._connected:
            return []
        response = await self._transport.send({"method": "tools/list"})
        return response.get("tools", [])

    async def call_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        user_role: str = "ADMIN",
    ) -> dict[str, Any]:
        if not self._connected:
            return {"error": "Client not connected"}

        t0 = time.monotonic()
        response = await self._transport.send({
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
                "user_role": user_role,
            },
        })
        elapsed = (time.monotonic() - t0) * 1000

        from app.self_healing.metrics import get_metrics_collector
        collector = get_metrics_collector()
        collector.record_latency(f"mcp_client:{tool_name}", elapsed)

        return response

    def get_status(self) -> dict[str, Any]:
        return {
            "server_url": self._server_url,
            "connected": self._connected,
        }


_client: MCPClient | None = None


def get_mcp_client() -> MCPClient:
    global _client
    if _client is None:
        _client = MCPClient()
    return _client


def reset_mcp_client() -> None:
    global _client
    _client = None
