"""Workflows router — run, list, monitor, and manage AI workflows.

Milestone 9: AI Workflow Orchestration.

Endpoints:
    GET  /api/v1/workflows           — List available workflows
    GET  /api/v1/workflows/stats     — Workflow execution statistics
    GET  /api/v1/workflows/history   — Paginated execution history
    GET  /api/v1/workflows/{id}      — Get a specific execution
    POST /api/v1/workflows/run       — Run a workflow
    POST /api/v1/workflows/cancel    — Cancel a running workflow
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.config.security import CurrentUser, RequireOwnerAdmin
from app.schemas import ErrorResponse
from app.services.workflow_service import (
    cancel_workflow,
    get_available_workflows,
    get_stats,
    get_workflow_execution,
    get_workflow_history,
    run_workflow,
)

router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.get(
    "",
    summary="List available workflows",
    responses={401: {"model": ErrorResponse}},
)
async def list_workflows_endpoint(user: CurrentUser) -> list[dict[str, Any]]:
    return await get_available_workflows()


@router.get(
    "/stats",
    summary="Workflow execution statistics",
    responses={401: {"model": ErrorResponse}},
)
async def workflow_stats(user: CurrentUser) -> dict[str, Any]:
    return await get_stats()


@router.get(
    "/history",
    summary="Paginated execution history",
    responses={401: {"model": ErrorResponse}},
)
async def workflow_history(
    user: CurrentUser,
    workflow_id: str | None = Query(default=None),
    restaurant_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    rid = restaurant_id or user.restaurantId
    return await get_workflow_history(
        restaurant_id=rid,
        workflow_id=workflow_id,
        status=status_filter,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{execution_id}",
    summary="Get workflow execution details",
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_execution_endpoint(
    execution_id: str,
    user: CurrentUser,
) -> dict[str, Any]:
    result = await get_workflow_execution(execution_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )
    return result


@router.post(
    "/run",
    summary="Run a workflow",
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def run_workflow_endpoint(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    wf_id = body.get("workflow_id", "")
    if not wf_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="workflow_id is required",
        )

    try:
        result = await run_workflow(
            wf_id,
            restaurant_id=body.get("restaurant_id", user.restaurantId),
            user_id=user.id,
            metadata=body.get("metadata", {}),
        )
        return result.model_dump(mode="json")
    except Exception as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/cancel",
    summary="Cancel a running workflow",
    responses={401: {"model": ErrorResponse}},
)
async def cancel_workflow_endpoint(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    wf_id = body.get("workflow_id", "")
    if not wf_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="workflow_id is required",
        )

    cancelled = await cancel_workflow(wf_id)
    return {"workflow_id": wf_id, "cancelled": cancelled}
