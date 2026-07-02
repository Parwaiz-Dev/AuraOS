"""Task Manager — tracks agent tasks and subtask execution."""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

from app.agents.models import AgentTask, SubTask, TaskStatus

logger = logging.getLogger(__name__)

_tasks: deque[AgentTask] = deque(maxlen=500)
_stats = {"total": 0, "completed": 0, "failed": 0}


def create_task(request: str, restaurant_id: str) -> AgentTask:
    task = AgentTask(request=request, restaurant_id=restaurant_id)
    _tasks.appendleft(task)
    _stats["total"] += 1
    return task


def complete_task(task: AgentTask, result: dict[str, Any]) -> None:
    from datetime import datetime, timezone
    task.status = TaskStatus.COMPLETED
    task.result = result
    task.completed_at = datetime.now(timezone.utc).isoformat()
    _stats["completed"] += 1


def fail_task(task: AgentTask, error: str) -> None:
    from datetime import datetime, timezone
    task.status = TaskStatus.FAILED
    task.errors.append(error)
    task.completed_at = datetime.now(timezone.utc).isoformat()
    _stats["failed"] += 1


def get_tasks(limit: int = 50) -> list[dict[str, Any]]:
    return [t.model_dump(mode="json") for t in list(_tasks)[:limit]]


def get_task_stats() -> dict[str, int]:
    return dict(_stats)


def reset_tasks() -> None:
    _tasks.clear()
    for key in _stats:
        _stats[key] = 0
