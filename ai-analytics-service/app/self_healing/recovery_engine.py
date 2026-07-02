"""Recovery Engine — orchestrates automatic recovery from detected failures."""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)


class RecoveryAction:
    __slots__ = ("component", "action", "success", "duration_ms", "error", "timestamp")

    def __init__(self, component: str, action: str) -> None:
        self.component = component
        self.action = action
        self.success = False
        self.duration_ms: float = 0.0
        self.error: str = ""
        self.timestamp: float = time.monotonic()

    def to_dict(self) -> dict[str, Any]:
        return {
            "component": self.component,
            "action": self.action,
            "success": self.success,
            "duration_ms": round(self.duration_ms, 2),
            "error": self.error,
        }


class RecoveryEngine:
    """Coordinates recovery actions: retry → restart → failover."""

    def __init__(self) -> None:
        self._history: deque[dict[str, Any]] = deque(maxlen=500)
        self._stats = {
            "total_recoveries": 0,
            "successful": 0,
            "failed": 0,
        }

    async def recover(self, component: str) -> dict[str, Any]:
        t0 = time.monotonic()
        self._stats["total_recoveries"] += 1

        # Stage 1: Restart
        record = RecoveryAction(component, "restart")
        try:
            from app.self_healing.restart_manager import get_restart_manager
            manager = get_restart_manager()
            result = await manager.restart_component(component)
            record.success = result.get("restarted", False)
            if not record.success:
                record.error = result.get("reason", "unknown")
        except Exception as exc:
            record.error = str(exc)
        record.duration_ms = (time.monotonic() - t0) * 1000

        if record.success:
            self._stats["successful"] += 1
            self._history.appendleft(record.to_dict())
            await self._emit_recovery_event(component, "restart", True)
            return record.to_dict()

        # Stage 2: Failover
        failover_record = RecoveryAction(component, "failover")
        t1 = time.monotonic()
        try:
            from app.self_healing.failover import get_failover
            fo = get_failover()
            if component == "redis":
                result = await fo.failover_redis()
            elif component == "database":
                result = await fo.failover_database()
            elif component.startswith("agent"):
                agent_id = component.split(":", 1)[1] if ":" in component else component
                result = await fo.failover_agent(agent_id)
            else:
                result = {"status": "no_failover_strategy"}
            failover_record.success = result.get("status") in ("active", "recovered")
            if not failover_record.success:
                failover_record.error = result.get("message", "no strategy")
        except Exception as exc:
            failover_record.error = str(exc)
        failover_record.duration_ms = (time.monotonic() - t1) * 1000

        if failover_record.success:
            self._stats["successful"] += 1
        else:
            self._stats["failed"] += 1

        combined = {
            "component": component,
            "restart": record.to_dict(),
            "failover": failover_record.to_dict(),
            "recovered": record.success or failover_record.success,
            "total_duration_ms": round((time.monotonic() - t0) * 1000, 2),
        }
        self._history.appendleft(combined)
        await self._emit_recovery_event(
            component,
            "failover" if failover_record.success else "failed",
            failover_record.success,
        )
        return combined

    async def replay_dead_letters(self) -> dict[str, Any]:
        """Replay events from the dead-letter queue."""
        try:
            from app.events.dead_letter import get_dlq
            from app.events.event import BaseEvent
            from app.events.event_bus import get_event_bus

            dlq = get_dlq()
            entries = await dlq.get_all()
            bus = get_event_bus()

            replayed = 0
            failed = 0
            for entry in entries:
                try:
                    event = BaseEvent.from_store_dict(entry.get("event", {}))
                    event.retry_count = 0
                    event.status = "pending"
                    await bus.publish(event)
                    replayed += 1
                except Exception:
                    failed += 1

            if replayed > 0:
                await dlq.clear()

            return {"replayed": replayed, "failed": failed}
        except Exception as exc:
            return {"replayed": 0, "failed": 0, "error": str(exc)}

    async def _emit_recovery_event(self, component: str, action: str, success: bool) -> None:
        try:
            from app.events.event import BaseEvent
            from app.events.publisher import publish
            await publish(BaseEvent(
                event_name="SelfHealingRecovery",
                metadata={
                    "component": component,
                    "action": action,
                    "success": success,
                },
            ))
        except Exception:
            pass

    def get_history(self, limit: int = 50) -> list[dict[str, Any]]:
        return list(self._history)[:limit]

    def get_stats(self) -> dict[str, Any]:
        return dict(self._stats)

    def reset(self) -> None:
        self._history.clear()
        for key in self._stats:
            self._stats[key] = 0


_engine: RecoveryEngine | None = None


def get_recovery_engine() -> RecoveryEngine:
    global _engine
    if _engine is None:
        _engine = RecoveryEngine()
    return _engine


def reset_recovery_engine() -> None:
    global _engine
    _engine = None
