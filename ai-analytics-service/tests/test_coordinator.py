"""Tests for the Agent Coordinator."""

from __future__ import annotations

import pytest

from app.agents.coordinator import get_coordinator, reset_coordinator
from app.agents.planner import plan_subtasks


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_coordinator()


class TestPlanner:
    def test_revenue_request(self) -> None:
        subtasks = plan_subtasks("What is my revenue this week?", "r1")
        agent_ids = [s.agent_id for s in subtasks]
        assert "revenue_agent" in agent_ids

    def test_forecast_request(self) -> None:
        subtasks = plan_subtasks("Forecast next week orders", "r1")
        agent_ids = [s.agent_id for s in subtasks]
        assert "forecasting_agent" in agent_ids

    def test_inventory_request(self) -> None:
        subtasks = plan_subtasks("Check inventory stock levels", "r1")
        agent_ids = [s.agent_id for s in subtasks]
        assert "inventory_agent" in agent_ids

    def test_multi_domain_request(self) -> None:
        subtasks = plan_subtasks("Analyze revenue and customer trends", "r1")
        agent_ids = [s.agent_id for s in subtasks]
        assert "revenue_agent" in agent_ids
        assert "customer_agent" in agent_ids

    def test_unknown_request_defaults_to_analytics(self) -> None:
        subtasks = plan_subtasks("Tell me something interesting", "r1")
        agent_ids = [s.agent_id for s in subtasks]
        assert "analytics_agent" in agent_ids

    def test_monitoring_request(self) -> None:
        subtasks = plan_subtasks("Check model drift status", "r1")
        agent_ids = [s.agent_id for s in subtasks]
        assert "monitoring_agent" in agent_ids


@pytest.mark.asyncio
class TestCoordinator:
    async def test_process_simple_request(self) -> None:
        import app.agents  # noqa: F401
        coordinator = get_coordinator()
        result = await coordinator.process_request(
            request="Check monitoring status",
            restaurant_id="r1",
        )
        assert "task_id" in result
        assert "status" in result
        assert "agents_used" in result
        assert "duration_ms" in result

    async def test_process_multi_agent_request(self) -> None:
        import app.agents  # noqa: F401
        coordinator = get_coordinator()
        result = await coordinator.process_request(
            request="Analyze revenue and inventory",
            restaurant_id="r1",
        )
        assert len(result["agents_used"]) >= 1

    async def test_get_metrics(self) -> None:
        import app.agents  # noqa: F401
        coordinator = get_coordinator()
        metrics = await coordinator.get_metrics()
        assert "total_agents" in metrics
        assert metrics["total_agents"] >= 13
        assert "healthy" in metrics
        assert "total_tasks" in metrics

    async def test_restart_agent(self) -> None:
        import app.agents  # noqa: F401
        coordinator = get_coordinator()
        success = await coordinator.restart_agent("analytics_agent")
        assert success is True

    async def test_restart_nonexistent_agent(self) -> None:
        coordinator = get_coordinator()
        success = await coordinator.restart_agent("nonexistent")
        assert success is False
