"""Agent Coordinator — assigns tasks, collects results, handles failures."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.agents.models import AgentTask, SubTask, TaskStatus
from app.agents.planner import plan_subtasks
from app.agents.registry import get_agent
from app.agents.task_manager import complete_task, create_task, fail_task

logger = logging.getLogger(__name__)


class AgentCoordinator:
    """Orchestrates multi-agent task execution."""

    async def process_request(
        self,
        request: str,
        restaurant_id: str,
        user_id: str = "",
    ) -> dict[str, Any]:
        t0 = time.monotonic()
        task = create_task(request, restaurant_id)
        task.status = TaskStatus.RUNNING

        subtasks = plan_subtasks(request, restaurant_id)
        task.subtasks = subtasks

        results: dict[str, Any] = {}
        errors: list[str] = []

        agent_tasks = [
            self._execute_subtask(st) for st in subtasks
        ]
        subtask_results = await asyncio.gather(*agent_tasks, return_exceptions=True)

        for st, result in zip(subtasks, subtask_results):
            if isinstance(result, Exception):
                st.status = TaskStatus.FAILED
                st.error = str(result)
                errors.append(f"{st.agent_id}: {result}")
            elif isinstance(result, dict):
                st.status = TaskStatus.COMPLETED
                st.result = result
                results[st.agent_id] = result
            else:
                st.status = TaskStatus.COMPLETED
                results[st.agent_id] = {"data": result}

        elapsed = (time.monotonic() - t0) * 1000
        task.duration_ms = round(elapsed, 2)

        if errors and not results:
            fail_task(task, "; ".join(errors))
        else:
            complete_task(task, results)

        try:
            from app.events.event import BaseEvent
            from app.events.publisher import publish
            await publish(BaseEvent(
                event_name="AgentTaskCompleted",
                restaurant_id=restaurant_id,
                metadata={
                    "task_id": task.task_id,
                    "agents": list(results.keys()),
                    "status": task.status,
                    "duration_ms": task.duration_ms,
                },
            ))
        except Exception:
            pass

        return {
            "task_id": task.task_id,
            "status": task.status,
            "agents_used": list(results.keys()),
            "results": results,
            "errors": errors,
            "duration_ms": task.duration_ms,
        }

    async def _execute_subtask(self, subtask: SubTask) -> dict[str, Any]:
        agent = get_agent(subtask.agent_id)
        if agent is None:
            return {"error": f"Agent {subtask.agent_id} not found", "skipped": True}

        t0 = time.monotonic()
        subtask.status = TaskStatus.RUNNING

        try:
            result = await asyncio.wait_for(
                agent.process(subtask.parameters),
                timeout=60.0,
            )
            subtask.duration_ms = round((time.monotonic() - t0) * 1000, 2)
            return result
        except asyncio.TimeoutError:
            subtask.duration_ms = round((time.monotonic() - t0) * 1000, 2)
            raise
        except Exception:
            subtask.duration_ms = round((time.monotonic() - t0) * 1000, 2)
            raise

    async def restart_agent(self, agent_id: str) -> bool:
        agent = get_agent(agent_id)
        if agent is None:
            return False
        agent.restart()
        logger.info("Agent %s restarted", agent_id)
        return True

    async def get_agent_status(self) -> list[dict[str, Any]]:
        from app.agents.registry import list_agent_info
        return list_agent_info()

    async def get_metrics(self) -> dict[str, Any]:
        from app.agents.registry import get_all_agents
        from app.agents.messaging import get_messaging_stats
        from app.agents.task_manager import get_task_stats

        agents = get_all_agents()
        healthy = sum(1 for a in agents.values() if a.status == "IDLE")
        busy = sum(1 for a in agents.values() if a.status == "BUSY")
        failed = sum(1 for a in agents.values() if a.status == "FAILED")
        restarts = sum(a._restart_count for a in agents.values())

        durations = [a._avg_response_ms for a in agents.values() if a._avg_response_ms > 0]
        avg = round(sum(durations) / len(durations), 2) if durations else 0.0

        task_stats = get_task_stats()
        msg_stats = get_messaging_stats()

        return {
            "total_agents": len(agents),
            "healthy": healthy,
            "busy": busy,
            "failed": failed,
            "total_tasks": task_stats["total"],
            "completed_tasks": task_stats["completed"],
            "failed_tasks": task_stats["failed"],
            "avg_response_ms": avg,
            "total_messages": msg_stats["total_sent"],
            "total_restarts": restarts,
        }


_coordinator: AgentCoordinator | None = None


def get_coordinator() -> AgentCoordinator:
    global _coordinator
    if _coordinator is None:
        _coordinator = AgentCoordinator()
    return _coordinator


def reset_coordinator() -> None:
    global _coordinator
    _coordinator = None
