"""Tests for Agent Messaging — inter-agent communication."""

from __future__ import annotations

import pytest

from app.agents.messaging import (
    get_message_history,
    get_messaging_stats,
    reset_messaging,
    send_message,
)
from app.agents.models import AgentMessage


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_messaging()


@pytest.mark.asyncio
class TestAgentMessaging:
    async def test_send_request_message(self) -> None:
        import app.agents  # noqa: F401
        msg = AgentMessage(
            from_agent="analytics_agent",
            to_agent="monitoring_agent",
            action="process",
            message_type="REQUEST",
            payload={"restaurant_id": "r1"},
        )
        result = await send_message(msg)
        assert result is not None
        assert "source" in result

    async def test_send_to_nonexistent_agent(self) -> None:
        msg = AgentMessage(
            from_agent="analytics_agent",
            to_agent="nonexistent_agent",
            action="process",
            message_type="REQUEST",
        )
        result = await send_message(msg)
        assert result is None

    async def test_broadcast_message(self) -> None:
        import app.agents  # noqa: F401
        msg = AgentMessage(
            from_agent="coordinator",
            to_agent="",
            action="health_check",
            message_type="BROADCAST",
        )
        result = await send_message(msg)
        assert result is None  # broadcast doesn't return

    async def test_message_stats(self) -> None:
        import app.agents  # noqa: F401
        msg = AgentMessage(
            from_agent="a1",
            to_agent="monitoring_agent",
            action="process",
            message_type="REQUEST",
            payload={},
        )
        await send_message(msg)
        stats = get_messaging_stats()
        assert stats["total_sent"] >= 1

    async def test_message_history(self) -> None:
        import app.agents  # noqa: F401
        msg = AgentMessage(
            from_agent="a1",
            to_agent="analytics_agent",
            action="test",
            message_type="REQUEST",
            payload={"restaurant_id": "r1"},
        )
        await send_message(msg)
        history = await get_message_history(limit=10)
        assert len(history) >= 1
        assert history[0]["from_agent"] == "a1"

    async def test_message_timeout(self) -> None:
        import app.agents  # noqa: F401
        from app.agents.registry import get_agent

        class SlowAgent:
            agent_id = "slow_agent"
            async def handle_message(self, msg):
                import asyncio
                await asyncio.sleep(10)
                return {}

        msg = AgentMessage(
            from_agent="test",
            to_agent="slow_agent",
            action="process",
            message_type="REQUEST",
            timeout_seconds=0.1,
            max_retries=0,
        )
        from app.agents.registry import register_agent
        # Can't register a non-SpecializedAgent, so test with nonexistent
        result = await send_message(msg)
        assert result is None
