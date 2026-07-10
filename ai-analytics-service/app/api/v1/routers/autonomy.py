"""Autonomy router — autonomous AI dashboard and control endpoints.

Milestone 10: Fully Autonomous AI Restaurant OS.

Endpoints:
    GET  /api/v1/autonomy/status            — Engine status and stats
    GET  /api/v1/autonomy/actions            — Registered action definitions
    GET  /api/v1/autonomy/history            — Execution history
    GET  /api/v1/autonomy/pending-approvals  — Pending approval requests
    POST /api/v1/autonomy/approve            — Approve a pending action
    POST /api/v1/autonomy/reject             — Reject a pending action
    POST /api/v1/autonomy/run               — Manually trigger an autonomous action
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.config.security import CurrentUser, RequireOwnerAdmin, resolve_tenant_id
from app.schemas import ErrorResponse
from app.services.autonomy_service import (
    approve_action,
    get_actions,
    get_history,
    get_pending_approvals,
    get_status,
    reject_action,
    run_autonomous_action,
)

router = APIRouter(prefix="/autonomy", tags=["Autonomy"])


@router.get(
    "/status",
    summary="Autonomous engine status",
    responses={401: {"model": ErrorResponse}},
)
async def autonomy_status(user: CurrentUser) -> dict[str, Any]:
    return await get_status()


@router.get(
    "/actions",
    summary="Registered autonomous actions",
    responses={401: {"model": ErrorResponse}},
)
async def autonomy_actions(user: CurrentUser) -> list[dict[str, Any]]:
    return await get_actions()


@router.get(
    "/history",
    summary="Autonomous execution history",
    responses={401: {"model": ErrorResponse}},
)
async def autonomy_history(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[dict[str, Any]]:
    return await get_history(limit=limit)


@router.get(
    "/pending-approvals",
    summary="Pending approval requests",
    responses={401: {"model": ErrorResponse}},
)
async def pending_approvals(user: CurrentUser) -> list[dict[str, Any]]:
    return await get_pending_approvals(restaurant_id=user.restaurantId)


@router.post(
    "/approve",
    summary="Approve a pending action",
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def approve_endpoint(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    request_id = body.get("request_id", "")
    if not request_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="request_id is required")

    result = await approve_action(request_id, resolved_by=user.id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")
    return result


@router.post(
    "/reject",
    summary="Reject a pending action",
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def reject_endpoint(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    request_id = body.get("request_id", "")
    if not request_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="request_id is required")

    result = await reject_action(request_id, resolved_by=user.id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")
    return result


@router.post(
    "/run",
    summary="Manually trigger an autonomous action",
    responses={401: {"model": ErrorResponse}},
)
async def run_action_endpoint(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    action_name = body.get("action_name", "")
    if not action_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action_name is required")

    return await run_autonomous_action(
        action_name=action_name,
        restaurant_id=resolve_tenant_id(user, body.get("restaurant_id")),
        user_id=user.id,
        parameters=body.get("parameters", {}),
    )
