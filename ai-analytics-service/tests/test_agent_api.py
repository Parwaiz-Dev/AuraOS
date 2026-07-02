"""Tests for Multi-Agent API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestAgentsListAPI:
    async def test_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/agents")
        assert response.status_code == 401

    async def test_list_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/agents", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 13
        ids = [a["agent_id"] for a in data]
        assert "analytics_agent" in ids
        assert "forecasting_agent" in ids
        assert "customer_agent" in ids
        assert "revenue_agent" in ids
        assert "inventory_agent" in ids
        assert "recommendation_agent" in ids
        assert "marketing_agent" in ids
        assert "operations_agent" in ids
        assert "notification_agent" in ids
        assert "rag_agent" in ids
        assert "copilot_agent" in ids
        assert "reporting_agent" in ids
        assert "monitoring_agent" in ids


@pytest.mark.asyncio
class TestAgentsStatusAPI:
    async def test_status_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/agents/status")
        assert response.status_code == 401

    async def test_status_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/agents/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 13


@pytest.mark.asyncio
class TestAgentsMetricsAPI:
    async def test_metrics_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/agents/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_agents" in data
        assert data["total_agents"] >= 13
        assert "healthy" in data
        assert "total_tasks" in data


@pytest.mark.asyncio
class TestAgentsTasksAPI:
    async def test_tasks_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/agents/tasks", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
class TestAgentsHistoryAPI:
    async def test_history_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/agents/history", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
class TestAgentsRunAPI:
    async def test_run_requires_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/agents/run", json={"request": "test"})
        assert response.status_code == 401

    async def test_run_requires_admin(self, client: AsyncClient, waiter_headers: dict) -> None:
        response = await client.post(
            "/api/v1/agents/run",
            json={"request": "test"},
            headers=waiter_headers,
        )
        assert response.status_code == 403

    async def test_run_missing_request(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post("/api/v1/agents/run", json={}, headers=auth_headers)
        assert response.status_code == 400


@pytest.mark.asyncio
class TestAgentsRestartAPI:
    async def test_restart_requires_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/agents/restart", json={"agent_id": "x"})
        assert response.status_code == 401

    async def test_restart_missing_id(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post("/api/v1/agents/restart", json={}, headers=auth_headers)
        assert response.status_code == 400

    async def test_restart_nonexistent(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post(
            "/api/v1/agents/restart",
            json={"agent_id": "nonexistent"},
            headers=auth_headers,
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestAgentsMessageAPI:
    async def test_message_requires_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/agents/message", json={"to_agent": "x", "action": "y"})
        assert response.status_code == 401

    async def test_message_missing_fields(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post("/api/v1/agents/message", json={}, headers=auth_headers)
        assert response.status_code == 400
