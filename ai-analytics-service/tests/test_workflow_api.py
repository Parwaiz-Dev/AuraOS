"""Tests for the workflow API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


def _pg_is_reachable() -> bool:
    try:
        import psycopg2
        conn = psycopg2.connect(
            host="localhost", port=5433,
            user="auraos_user", password="auraos_password",
            database="auraos", connect_timeout=3,
        )
        conn.close()
        return True
    except Exception:
        return False


_DB_OK = _pg_is_reachable()


@pytest.mark.asyncio
class TestWorkflowListAPI:
    async def test_list_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/workflows")
        assert response.status_code == 401

    async def test_list_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/workflows", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5
        names = [w["workflow_id"] for w in data]
        assert "daily_analytics" in names
        assert "model_retraining" in names
        assert "inventory_workflow" in names
        assert "copilot_workflow" in names
        assert "weekly_report" in names


@pytest.mark.asyncio
class TestWorkflowStatsAPI:
    async def test_stats_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/workflows/stats")
        assert response.status_code == 401

    async def test_stats_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/workflows/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_workflows" in data
        assert "success_rate" in data


@pytest.mark.asyncio
class TestWorkflowHistoryAPI:
    async def test_history_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/workflows/history")
        assert response.status_code == 401

    async def test_history_with_auth(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/workflows/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data


@pytest.mark.asyncio
class TestWorkflowRunAPI:
    async def test_run_requires_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/workflows/run", json={"workflow_id": "daily_analytics"})
        assert response.status_code == 401

    async def test_run_missing_workflow_id(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post("/api/v1/workflows/run", json={}, headers=auth_headers)
        assert response.status_code == 400

    async def test_run_nonexistent_workflow(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post(
            "/api/v1/workflows/run",
            json={"workflow_id": "nonexistent"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_run_requires_admin_role(self, client: AsyncClient, waiter_headers: dict) -> None:
        response = await client.post(
            "/api/v1/workflows/run",
            json={"workflow_id": "daily_analytics"},
            headers=waiter_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestWorkflowCancelAPI:
    async def test_cancel_requires_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/workflows/cancel", json={"workflow_id": "x"})
        assert response.status_code == 401

    async def test_cancel_missing_id(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.post("/api/v1/workflows/cancel", json={}, headers=auth_headers)
        assert response.status_code == 400


@pytest.mark.asyncio
class TestWorkflowExecutionAPI:
    async def test_get_nonexistent_execution(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get(
            "/api/v1/workflows/nonexistent-id",
            headers=auth_headers,
        )
        assert response.status_code == 404
