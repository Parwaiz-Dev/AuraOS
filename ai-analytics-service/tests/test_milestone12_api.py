"""Tests for Milestone 12 Health Dashboard, MCP, and Graph API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.langgraph.graph import reset_graph_registry
from app.langgraph.graph_executor import reset_graph_executor
from app.langgraph.graph_memory import reset_graph_memory
from app.mcp.client import reset_mcp_client
from app.mcp.permissions import reset_permission_manager
from app.mcp.registry import reset_mcp_registry
from app.mcp.server import reset_mcp_server
from app.self_healing.anomaly_monitor import reset_anomaly_monitor
from app.self_healing.circuit_breaker import reset_circuit_breakers
from app.self_healing.health_monitor import reset_health_monitor
from app.self_healing.metrics import reset_metrics_collector
from app.self_healing.recovery_engine import reset_recovery_engine
from app.self_healing.restart_manager import reset_restart_manager

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _reset_m12():
    reset_health_monitor()
    reset_recovery_engine()
    reset_restart_manager()
    reset_circuit_breakers()
    reset_anomaly_monitor()
    reset_metrics_collector()
    reset_mcp_registry()
    reset_mcp_server()
    reset_mcp_client()
    reset_permission_manager()
    reset_graph_executor()
    reset_graph_memory()
    reset_graph_registry()
    yield
    reset_health_monitor()
    reset_recovery_engine()
    reset_restart_manager()
    reset_circuit_breakers()
    reset_anomaly_monitor()
    reset_metrics_collector()
    reset_mcp_registry()
    reset_mcp_server()
    reset_mcp_client()
    reset_permission_manager()
    reset_graph_executor()
    reset_graph_memory()
    reset_graph_registry()


# ── Health Dashboard ──────────────────────────────────────────────────────────


async def test_health_system(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/health/system", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "system" in data
    assert "agents" in data
    assert "metrics" in data


async def test_health_agents(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/health/agents", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "healthy" in data


async def test_health_workflows(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/health/workflows", headers=auth_headers)
    assert response.status_code == 200


async def test_health_metrics(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/health/metrics", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "uptime_seconds" in data


async def test_health_anomalies(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/health/anomalies", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_health_recovery(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/health/recovery", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_health_recover_missing_component(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/health/recover",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_health_recover_component(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/health/recover",
        json={"component": "event_bus"},
        headers=auth_headers,
    )
    assert response.status_code == 200


async def test_health_replay_dlq(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/health/replay-dlq",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "replayed" in data


async def test_health_no_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/system")
    assert response.status_code == 401


# ── MCP ───────────────────────────────────────────────────────────────────────


async def test_mcp_list_tools(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/mcp/tools", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 7


async def test_mcp_list_tools_category(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.get(
        "/api/v1/mcp/tools?category=external",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert all(t["category"] == "external" for t in data)


async def test_mcp_execute(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/mcp/execute",
        json={"tool_name": "weather", "parameters": {"location": "NYC"}},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True


async def test_mcp_execute_missing_tool_name(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/mcp/execute",
        json={"parameters": {}},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_mcp_register(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/mcp/register",
        json={"name": "my_tool", "description": "A custom tool"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["registered"] is True


async def test_mcp_register_missing_name(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/mcp/register",
        json={"description": "No name"},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_mcp_register_rbac(
    client: AsyncClient, waiter_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/mcp/register",
        json={"name": "x"},
        headers=waiter_headers,
    )
    assert response.status_code == 403


async def test_mcp_stats(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/mcp/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "registered_tools" in data


async def test_mcp_log(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/mcp/log", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ── LangGraph ─────────────────────────────────────────────────────────────────


async def test_graph_list(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/graph", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3


async def test_graph_status(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/graph/status", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "available_graphs" in data
    assert "execution_stats" in data


async def test_graph_run_missing_id(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/graph/run",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_graph_run(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/graph/run",
        json={"graph_id": "self_healing", "query": "check system health"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "visited_nodes" in data


async def test_graph_run_nonexistent(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.post(
        "/api/v1/graph/run",
        json={"graph_id": "nonexistent"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "error" in data


async def test_graph_history(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/graph/history", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_graph_topology(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get("/api/v1/graph/analytics", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data


async def test_graph_topology_not_found(
    client: AsyncClient, auth_headers: dict,
) -> None:
    response = await client.get("/api/v1/graph/nope", headers=auth_headers)
    assert response.status_code == 404


async def test_graph_visualize(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get(
        "/api/v1/graph/analytics/visualize",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "mermaid" in data
    assert "graph TD" in data["mermaid"]


async def test_graph_no_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/graph")
    assert response.status_code == 401
