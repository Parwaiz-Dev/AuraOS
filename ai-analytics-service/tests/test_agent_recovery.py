"""Tests for Agent Auto-Recovery."""

from __future__ import annotations

import pytest

from app.agents.coordinator import get_coordinator, reset_coordinator
from app.agents.registry import get_agent


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_coordinator()


@pytest.mark.asyncio
class TestAgentRecovery:
    async def test_restart_failed_agent(self) -> None:
        import app.agents  # noqa: F401
        agent = get_agent("analytics_agent")
        assert agent is not None

        agent.status = "FAILED"
        assert agent.get_info().health == "unhealthy"

        coordinator = get_coordinator()
        success = await coordinator.restart_agent("analytics_agent")
        assert success is True
        assert agent.status == "IDLE"
        assert agent._restart_count >= 1

    async def test_restart_increments_counter(self) -> None:
        import app.agents  # noqa: F401
        agent = get_agent("forecasting_agent")
        assert agent is not None

        initial_count = agent._restart_count
        agent.status = "FAILED"
        agent.restart()
        assert agent._restart_count == initial_count + 1
        agent.restart()
        assert agent._restart_count == initial_count + 2

    async def test_restart_nonexistent_returns_false(self) -> None:
        coordinator = get_coordinator()
        success = await coordinator.restart_agent("does_not_exist")
        assert success is False

    async def test_agent_processes_after_restart(self) -> None:
        import app.agents  # noqa: F401
        agent = get_agent("monitoring_agent")
        assert agent is not None

        agent.status = "FAILED"
        agent.restart()

        result = await agent.process({"restaurant_id": "r1"})
        assert "source" in result
        assert result["source"] == "monitoring_agent"

    async def test_multiple_agents_restart(self) -> None:
        import app.agents  # noqa: F401
        coordinator = get_coordinator()

        for aid in ["analytics_agent", "forecasting_agent", "customer_agent"]:
            agent = get_agent(aid)
            if agent:
                agent.status = "FAILED"

        for aid in ["analytics_agent", "forecasting_agent", "customer_agent"]:
            success = await coordinator.restart_agent(aid)
            assert success is True

        metrics = await coordinator.get_metrics()
        assert metrics["failed"] == 0
