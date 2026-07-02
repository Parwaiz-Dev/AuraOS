"""Workflow Service — service-layer bridge between routers and the engine."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow_engine import get_workflow_engine
from app.workflows.workflow_executor import (
    get_execution,
    get_workflow_stats,
    query_executions,
)
from app.workflows.workflow_result import WorkflowResult

logger = logging.getLogger(__name__)


async def run_workflow(
    workflow_id: str,
    *,
    restaurant_id: str = "",
    user_id: str = "",
    request_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> WorkflowResult:
    engine = get_workflow_engine()
    return await engine.run(
        workflow_id,
        restaurant_id=restaurant_id,
        user_id=user_id,
        request_id=request_id,
        metadata=metadata,
    )


async def cancel_workflow(workflow_id: str) -> bool:
    engine = get_workflow_engine()
    return await engine.cancel(workflow_id)


async def get_available_workflows() -> list[dict[str, Any]]:
    engine = get_workflow_engine()
    return engine.list_available()


async def get_workflow_execution(execution_id: str) -> dict[str, Any] | None:
    return await get_execution(execution_id)


async def get_workflow_history(
    *,
    restaurant_id: str | None = None,
    workflow_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    return await query_executions(
        restaurant_id=restaurant_id,
        workflow_id=workflow_id,
        status=status,
        page=page,
        page_size=page_size,
    )


async def get_stats() -> dict[str, Any]:
    return await get_workflow_stats()
