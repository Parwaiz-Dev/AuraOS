"""Model Context Protocol (MCP) — Milestone 12.

Provides MCP server/client, tool discovery, registration, execution,
permission control, and external AI tool integration.
"""

from app.mcp.exceptions import (
    MCPError,
    MCPPermissionError,
    MCPToolError,
    MCPToolNotFoundError,
    MCPTransportError,
)
from app.mcp.models import MCPTool, MCPToolResult, ToolPermission
from app.mcp.registry import MCPRegistry, get_mcp_registry, reset_mcp_registry

__all__ = [
    "MCPError",
    "MCPPermissionError",
    "MCPRegistry",
    "MCPTool",
    "MCPToolError",
    "MCPToolNotFoundError",
    "MCPToolResult",
    "MCPTransportError",
    "ToolPermission",
    "get_mcp_registry",
    "reset_mcp_registry",
]
