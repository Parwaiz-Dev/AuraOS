"""Tests for agent models, registry, and base agent."""

from __future__ import annotations

import pytest

from app.agents.base_agent import SpecializedAgent
from app.agents.models import (
    AgentInfo,
    AgentMessage,
    AgentMetrics,
    AgentStatus,
    AgentTask,
    MessageType,
    SubTask,
    TaskStatus,
)
from app.agents.registry import (
    clear_agents,
    get_agent,
    get_agents_by_capability,
    get_agents_by_event,
    get_all_agents,
    list_agent_info,
    register_agent,
)


class TestAgentModels:
    def test_agent_info(self) -> None:
        info = AgentInfo(agent_id="test", name="Test Agent", capabilities=["analytics"])
        assert info.status == "IDLE"
        assert info.health == "healthy"

    def test_agent_message(self) -> None:
        msg = AgentMessage(from_agent="a1", to_agent="a2", action="process")
        assert msg.message_id
        assert msg.message_type == "REQUEST"
        assert not msg.acknowledged

    def test_agent_task(self) -> None:
        task = AgentTask(request="analyze revenue", restaurant_id="r1")
        assert task.task_id
        assert task.status == "PENDING"
        assert task.subtasks == []

    def test_subtask(self) -> None:
        st = SubTask(agent_id="analytics_agent", action="process")
        assert st.subtask_id
        assert st.status == "PENDING"

    def test_agent_metrics(self) -> None:
        m = AgentMetrics(total_agents=13, healthy=12, busy=1)
        assert m.total_agents == 13

    def test_enums(self) -> None:
        assert AgentStatus.IDLE == "IDLE"
        assert MessageType.BROADCAST == "BROADCAST"
        assert TaskStatus.COMPLETED == "COMPLETED"

    def test_task_serialization(self) -> None:
        task = AgentTask(
            request="test",
            restaurant_id="r1",
            subtasks=[SubTask(agent_id="a1", action="x")],
        )
        data = task.model_dump(mode="json")
        restored = AgentTask.model_validate(data)
        assert len(restored.subtasks) == 1


class TestAgentRegistry:
    def test_builtin_agents_registered(self) -> None:
        import app.agents  # noqa: F401
        agents = get_all_agents()
        assert len(agents) >= 13

    def test_get_agent(self) -> None:
        import app.agents  # noqa: F401
        agent = get_agent("analytics_agent")
        assert agent is not None
        assert agent.name == "Analytics Agent"

    def test_get_agents_by_capability(self) -> None:
        import app.agents  # noqa: F401
        agents = get_agents_by_capability("forecast")
        assert len(agents) >= 1
        assert any(a.agent_id == "forecasting_agent" for a in agents)

    def test_get_agents_by_event(self) -> None:
        import app.agents  # noqa: F401
        agents = get_agents_by_event("OrderCompleted")
        assert len(agents) >= 1

    def test_list_agent_info(self) -> None:
        import app.agents  # noqa: F401
        infos = list_agent_info()
        assert len(infos) >= 13
        names = [i["agent_id"] for i in infos]
        assert "analytics_agent" in names
        assert "forecasting_agent" in names
        assert "customer_agent" in names
        assert "monitoring_agent" in names

    def test_agent_info_structure(self) -> None:
        import app.agents  # noqa: F401
        agent = get_agent("revenue_agent")
        assert agent is not None
        info = agent.get_info()
        assert info.agent_id == "revenue_agent"
        assert info.status == "IDLE"
        assert info.health == "healthy"
        assert len(info.capabilities) > 0

    def test_agent_restart(self) -> None:
        import app.agents  # noqa: F401
        agent = get_agent("analytics_agent")
        assert agent is not None
        agent.status = "FAILED"
        agent.restart()
        assert agent.status == "IDLE"
        assert agent._restart_count >= 1
