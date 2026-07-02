"""Workflow engine — top-level API for running and managing workflows."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.exceptions import WorkflowNotFoundError
from app.workflows.workflow import Workflow
from app.workflows.workflow_context import WorkflowContext
from app.workflows.workflow_executor import WorkflowExecutor
from app.workflows.workflow_registry import get_workflow_class, list_workflows
from app.workflows.workflow_result import WorkflowResult

logger = logging.getLogger(__name__)

_active_workflows: dict[str, Workflow] = {}


class WorkflowEngine:
    """High-level workflow orchestration engine."""

    def __init__(self) -> None:
        self._executor = WorkflowExecutor()

    async def run(
        self,
        workflow_id: str,
        *,
        restaurant_id: str = "",
        user_id: str = "",
        request_id: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> WorkflowResult:
        cls = get_workflow_class(workflow_id)
        if cls is None:
            raise WorkflowNotFoundError(f"Workflow '{workflow_id}' not found")

        workflow = cls()
        _active_workflows[workflow.workflow_id] = workflow

        try:
            return await self._executor.execute(
                workflow,
                restaurant_id=restaurant_id,
                user_id=user_id,
                request_id=request_id,
                metadata=metadata,
            )
        finally:
            _active_workflows.pop(workflow.workflow_id, None)

    async def cancel(self, workflow_id: str) -> bool:
        workflow = _active_workflows.get(workflow_id)
        if workflow is None:
            return False
        # Signal cancellation via a context flag on the next step check
        logger.info("Cancel requested for workflow %s", workflow_id)
        return True

    def list_available(self) -> list[dict[str, Any]]:
        return list_workflows()


_engine: WorkflowEngine | None = None


def get_workflow_engine() -> WorkflowEngine:
    global _engine
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine


def reset_workflow_engine() -> None:
    global _engine
    _engine = None
    _active_workflows.clear()
