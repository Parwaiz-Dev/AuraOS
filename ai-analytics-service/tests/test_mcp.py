"""Tests for MCP (Model Context Protocol) — Milestone 12."""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.mcp.client import MCPClient, get_mcp_client, reset_mcp_client
from app.mcp.exceptions import MCPPermissionError, MCPToolNotFoundError
from app.mcp.models import MCPRequest, MCPTool, MCPToolResult
from app.mcp.permissions import PermissionManager, get_permission_manager, reset_permission_manager
from app.mcp.registry import MCPRegistry, get_mcp_registry, reset_mcp_registry
from app.mcp.server import MCPServer, get_mcp_server, reset_mcp_server
from app.mcp.tool_adapter import (
    BaseTool,
    CalendarTool,
    CustomTool,
    DatabaseQueryTool,
    EmailTool,
    FilesystemTool,
    HttpTool,
    WeatherTool,
    WebhookTool,
    get_builtin_tools,
)
from app.mcp.transport import MCPTransport
from app.self_healing.circuit_breaker import reset_circuit_breakers
from app.self_healing.metrics import reset_metrics_collector


@pytest.fixture(autouse=True)
def _reset():
    reset_mcp_registry()
    reset_mcp_server()
    reset_mcp_client()
    reset_permission_manager()
    reset_circuit_breakers()
    reset_metrics_collector()
    yield
    reset_mcp_registry()
    reset_mcp_server()
    reset_mcp_client()
    reset_permission_manager()
    reset_circuit_breakers()
    reset_metrics_collector()


class TestMCPModels:
    def test_mcp_tool_creation(self):
        tool = MCPTool(name="test_tool", description="A test tool")
        assert tool.name == "test_tool"
        assert tool.enabled is True
        assert tool.version == "1.0.0"

    def test_mcp_tool_result(self):
        result = MCPToolResult(tool_name="test", success=True, data={"ok": True})
        assert result.success
        assert result.data["ok"] is True

    def test_mcp_request(self):
        req = MCPRequest(tool_name="weather", parameters={"location": "NYC"})
        assert req.tool_name == "weather"

    def test_defaults(self):
        tool = MCPTool(name="x")
        assert tool.tool_id  # UUID generated
        assert tool.category == "internal"
        assert tool.required_permissions == ["read"]


class TestToolAdapters:
    @pytest.mark.asyncio
    async def test_weather_tool(self):
        tool = WeatherTool()
        result = await tool.execute({"location": "Tokyo"})
        assert result["location"] == "Tokyo"
        assert "temperature_c" in result

    @pytest.mark.asyncio
    async def test_calendar_tool(self):
        tool = CalendarTool()
        result = await tool.execute({"action": "list"})
        assert result["action"] == "list"

    @pytest.mark.asyncio
    async def test_email_tool(self):
        tool = EmailTool()
        result = await tool.execute({"to": "test@test.com", "subject": "Hi"})
        assert result["sent"] is True

    @pytest.mark.asyncio
    async def test_webhook_tool(self):
        tool = WebhookTool()
        result = await tool.execute({"url": "https://example.com"})
        assert result["status"] == "queued"

    @pytest.mark.asyncio
    async def test_filesystem_tool(self):
        tool = FilesystemTool()
        result = await tool.execute({"path": "/data/test.csv"})
        assert "exists" in result

    @pytest.mark.asyncio
    async def test_http_tool(self):
        tool = HttpTool()
        result = await tool.execute({"url": "https://api.example.com", "method": "GET"})
        assert result["method"] == "GET"

    @pytest.mark.asyncio
    async def test_database_query_tool_no_rid(self):
        tool = DatabaseQueryTool()
        result = await tool.execute({})
        assert "error" in result

    @pytest.mark.asyncio
    async def test_custom_tool(self):
        tool = CustomTool(
            name="custom_test",
            description="Test custom",
            handler=lambda p: {"custom": True, **p},
        )
        result = await tool.execute({"key": "val"})
        assert result["custom"] is True
        assert result["key"] == "val"

    @pytest.mark.asyncio
    async def test_safe_execute_success(self):
        tool = WeatherTool()
        result = await tool.safe_execute({"location": "LA"})
        assert result.success
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_safe_execute_failure(self):
        class BrokenTool(BaseTool):
            name = "broken"
            async def execute(self, parameters):
                raise RuntimeError("boom")

        tool = BrokenTool()
        result = await tool.safe_execute({})
        assert not result.success
        assert "boom" in result.error

    def test_get_builtin_tools(self):
        tools = get_builtin_tools()
        assert len(tools) == 7
        names = {t.name for t in tools}
        assert "weather" in names
        assert "database_query" in names


class TestMCPRegistry:
    def test_register_and_list(self):
        registry = MCPRegistry()
        tool = WeatherTool()
        registry.register(tool)
        tools = registry.list_tools()
        assert len(tools) == 1
        assert tools[0]["name"] == "weather"

    def test_unregister(self):
        registry = MCPRegistry()
        registry.register(WeatherTool())
        assert registry.unregister("weather")
        assert len(registry.list_tools()) == 0

    def test_unregister_nonexistent(self):
        registry = MCPRegistry()
        assert not registry.unregister("nope")

    def test_get_tool(self):
        registry = MCPRegistry()
        registry.register(WeatherTool())
        tool = registry.get_tool("weather")
        assert tool is not None
        assert tool.name == "weather"

    def test_discover_by_category(self):
        registry = MCPRegistry()
        registry.register(WeatherTool())
        registry.register(DatabaseQueryTool())
        ext = registry.discover("external")
        assert all(t["category"] == "external" for t in ext)

    @pytest.mark.asyncio
    async def test_execute_success(self):
        registry = MCPRegistry()
        registry.register(WeatherTool())
        result = await registry.execute("weather", {"location": "NYC"})
        assert result.success

    @pytest.mark.asyncio
    async def test_execute_not_found(self):
        registry = MCPRegistry()
        result = await registry.execute("nonexistent", {})
        assert not result.success
        assert "not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_permission_denied(self):
        registry = MCPRegistry()
        registry.register(EmailTool())
        result = await registry.execute("email", {}, user_role="WAITER")
        assert not result.success
        assert "Permission denied" in result.error

    def test_register_builtins(self):
        registry = MCPRegistry()
        registry.register_builtins()
        tools = registry.list_tools()
        assert len(tools) == 7

    def test_stats(self):
        registry = MCPRegistry()
        stats = registry.get_stats()
        assert stats["registered_tools"] == 0
        assert stats["total_executions"] == 0

    def test_singleton(self):
        r1 = get_mcp_registry()
        r2 = get_mcp_registry()
        assert r1 is r2


class TestPermissionManager:
    def test_admin_has_all_permissions(self):
        pm = PermissionManager()
        assert pm.check_permission("any_tool", ["read"], "ADMIN")
        assert pm.check_permission("any_tool", ["write"], "ADMIN")
        assert pm.check_permission("any_tool", ["execute"], "ADMIN")
        assert pm.check_permission("any_tool", ["admin"], "ADMIN")

    def test_waiter_read_only(self):
        pm = PermissionManager()
        assert pm.check_permission("any_tool", ["read"], "WAITER")
        assert not pm.check_permission("any_tool", ["write"], "WAITER")
        assert not pm.check_permission("any_tool", ["execute"], "WAITER")

    def test_grant_override(self):
        pm = PermissionManager()
        assert not pm.check_permission("special", ["execute"], "WAITER")
        pm.grant_tool_permission("special", ["execute"])
        assert pm.check_permission("special", ["execute"], "WAITER")

    def test_revoke_override(self):
        pm = PermissionManager()
        pm.grant_tool_permission("tool", ["write"])
        pm.revoke_tool_permission("tool", ["write"])
        assert not pm.check_permission("tool", ["write"], "WAITER")

    def test_get_role_permissions(self):
        pm = PermissionManager()
        perms = pm.get_role_permissions("ADMIN")
        assert "read" in perms
        assert "admin" in perms


class TestMCPTransport:
    @pytest.mark.asyncio
    async def test_connect_disconnect(self):
        transport = MCPTransport()
        assert not transport.is_connected
        await transport.connect()
        assert transport.is_connected
        await transport.disconnect()
        assert not transport.is_connected

    @pytest.mark.asyncio
    async def test_send_not_connected(self):
        transport = MCPTransport()
        from app.mcp.exceptions import MCPTransportError
        with pytest.raises(MCPTransportError):
            await transport.send({"method": "tools/list"})

    @pytest.mark.asyncio
    async def test_list_tools(self):
        transport = MCPTransport()
        await transport.connect()
        response = await transport.send({"method": "tools/list"})
        assert "tools" in response

    @pytest.mark.asyncio
    async def test_unknown_method(self):
        transport = MCPTransport()
        await transport.connect()
        response = await transport.send({"method": "unknown/method"})
        assert "error" in response


class TestMCPServer:
    @pytest.mark.asyncio
    async def test_start_stop(self):
        server = MCPServer()
        assert not server.is_running
        await server.start()
        assert server.is_running
        await server.stop()
        assert not server.is_running

    @pytest.mark.asyncio
    async def test_list_tools(self):
        server = MCPServer()
        await server.start()
        tools = await server.list_tools()
        assert isinstance(tools, list)
        await server.stop()

    @pytest.mark.asyncio
    async def test_execute_tool(self):
        server = MCPServer()
        await server.start()
        result = await server.execute_tool("weather", {"location": "LA"})
        assert result.get("success") is True or "tool_name" in result
        await server.stop()

    @pytest.mark.asyncio
    async def test_handle_request_not_running(self):
        server = MCPServer()
        result = await server.handle_request({"method": "tools/list"})
        assert "error" in result

    def test_get_status(self):
        server = MCPServer()
        status = server.get_status()
        assert "running" in status
        assert "registered_tools" in status


class TestMCPClient:
    @pytest.mark.asyncio
    async def test_connect_disconnect(self):
        client = MCPClient()
        assert not client.is_connected
        await client.connect()
        assert client.is_connected
        await client.disconnect()
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_list_tools_connected(self):
        client = MCPClient()
        await client.connect()
        tools = await client.list_tools()
        assert isinstance(tools, list)
        await client.disconnect()

    @pytest.mark.asyncio
    async def test_list_tools_disconnected(self):
        client = MCPClient()
        tools = await client.list_tools()
        assert tools == []

    @pytest.mark.asyncio
    async def test_call_tool(self):
        client = MCPClient()
        await client.connect()
        result = await client.call_tool("weather", {"location": "SF"})
        assert isinstance(result, dict)
        await client.disconnect()

    def test_get_status(self):
        client = MCPClient()
        status = client.get_status()
        assert status["connected"] is False

    def test_singleton(self):
        c1 = get_mcp_client()
        c2 = get_mcp_client()
        assert c1 is c2
