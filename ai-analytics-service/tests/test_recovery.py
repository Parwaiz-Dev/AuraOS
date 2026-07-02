"""Tests for Recovery Engine — Milestone 12."""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.self_healing.circuit_breaker import reset_circuit_breakers
from app.self_healing.recovery_engine import RecoveryEngine, get_recovery_engine, reset_recovery_engine
from app.self_healing.restart_manager import reset_restart_manager


@pytest.fixture(autouse=True)
def _reset():
    reset_recovery_engine()
    reset_restart_manager()
    reset_circuit_breakers()
    yield
    reset_recovery_engine()
    reset_restart_manager()
    reset_circuit_breakers()


class TestRecoveryEngine:
    @pytest.mark.asyncio
    async def test_recover_unknown_component(self):
        engine = RecoveryEngine()
        result = await engine.recover("nonexistent_thing")
        assert isinstance(result, dict)
        assert "component" in result

    @pytest.mark.asyncio
    async def test_recover_redis(self):
        engine = RecoveryEngine()
        result = await engine.recover("redis")
        assert result["component"] == "redis"

    @pytest.mark.asyncio
    async def test_recover_event_bus(self):
        engine = RecoveryEngine()
        result = await engine.recover("event_bus")
        assert "component" in result

    @pytest.mark.asyncio
    async def test_history_tracking(self):
        engine = RecoveryEngine()
        await engine.recover("redis")
        await engine.recover("database")
        history = engine.get_history()
        assert len(history) == 2

    @pytest.mark.asyncio
    async def test_stats(self):
        engine = RecoveryEngine()
        await engine.recover("redis")
        stats = engine.get_stats()
        assert stats["total_recoveries"] >= 1

    @pytest.mark.asyncio
    async def test_reset(self):
        engine = RecoveryEngine()
        await engine.recover("redis")
        engine.reset()
        assert engine.get_history() == []
        assert engine.get_stats()["total_recoveries"] == 0

    @pytest.mark.asyncio
    async def test_replay_dead_letters(self):
        engine = RecoveryEngine()
        result = await engine.replay_dead_letters()
        assert "replayed" in result
        assert "failed" in result

    @pytest.mark.asyncio
    async def test_singleton(self):
        e1 = get_recovery_engine()
        e2 = get_recovery_engine()
        assert e1 is e2

    @pytest.mark.asyncio
    async def test_agent_recovery(self):
        engine = RecoveryEngine()
        result = await engine.recover("agent:monitoring_agent")
        assert "component" in result
