"""MCP exceptions."""

from __future__ import annotations


class MCPError(Exception):
    """Base exception for MCP subsystem."""


class MCPToolNotFoundError(MCPError):
    """The requested tool is not registered."""

    def __init__(self, tool_name: str) -> None:
        self.tool_name = tool_name
        super().__init__(f"MCP tool '{tool_name}' not found")


class MCPToolError(MCPError):
    """A tool execution failed."""

    def __init__(self, tool_name: str, reason: str = "") -> None:
        self.tool_name = tool_name
        super().__init__(f"MCP tool '{tool_name}' failed: {reason}")


class MCPPermissionError(MCPError):
    """Permission denied for the requested tool/action."""

    def __init__(self, tool_name: str, reason: str = "") -> None:
        self.tool_name = tool_name
        super().__init__(f"Permission denied for tool '{tool_name}': {reason}")


class MCPTransportError(MCPError):
    """Communication failure in the MCP transport layer."""

    def __init__(self, reason: str = "") -> None:
        super().__init__(f"MCP transport error: {reason}")
