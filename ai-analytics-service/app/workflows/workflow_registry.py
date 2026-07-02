"""Workflow registry — stores workflow definitions and provides lookup."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import Workflow

logger = logging.getLogger(__name__)

_registry: dict[str, type[Workflow]] = {}


def register_workflow(workflow_cls: type[Workflow]) -> type[Workflow]:
    """Register a workflow class by its workflow_id."""
    wid = workflow_cls.workflow_id or workflow_cls.name
    _registry[wid] = workflow_cls
    logger.debug("Registered workflow: %s", wid)
    return workflow_cls


def get_workflow_class(workflow_id: str) -> type[Workflow] | None:
    return _registry.get(workflow_id)


def list_workflows() -> list[dict[str, Any]]:
    results = []
    for wid, cls in _registry.items():
        results.append({
            "workflow_id": wid,
            "name": cls.name,
            "description": cls.description,
            "timeout_seconds": cls.timeout_seconds,
        })
    return results


def get_registered_ids() -> list[str]:
    return list(_registry.keys())


def clear_registry() -> None:
    _registry.clear()
