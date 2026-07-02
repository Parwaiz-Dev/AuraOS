"""Self-Healing Health Dashboard router — comprehensive system health.

Milestone 12: Self-Healing AI Platform.

Endpoints:
    GET /api/v1/health/system      — Full system health report
    GET /api/v1/health/agents      — Agent health status
    GET /api/v1/health/workflows   — Workflow health & circuit breakers
    GET /api/v1/health/metrics     — System & component metrics
    GET /api/v1/health/anomalies   — Detected anomalies
    GET /api/v1/health/recovery    — Recovery action history
    POST /api/v1/health/recover    — Trigger manual recovery
    POST /api/v1/health/replay-dlq — Replay dead-letter queue
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.config.security import CurrentUser, RequireOwnerAdmin
from app.schemas import ErrorResponse
from app.services.healing_service import (
    get_agent_health,
    get_anomalies,
    get_full_health_report,
    get_health_metrics,
    get_recovery_history,
    get_system_health,
    get_workflow_health,
    recover_component,
    replay_dead_letters,
)

router = APIRouter(prefix="/health", tags=["Health Dashboard"])


@router.get(
    "/system",
    summary="Full system health report",
    responses={401: {"model": ErrorResponse}},
)
async def system_health(user: CurrentUser) -> dict[str, Any]:
    return await get_full_health_report()


@router.get(
    "/agents",
    summary="Agent health status",
    responses={401: {"model": ErrorResponse}},
)
async def agent_health(user: CurrentUser) -> dict[str, Any]:
    return await get_agent_health()


@router.get(
    "/workflows",
    summary="Workflow health and circuit breakers",
    responses={401: {"model": ErrorResponse}},
)
async def workflow_health(user: CurrentUser) -> dict[str, Any]:
    return await get_workflow_health()


@router.get(
    "/metrics",
    summary="System and component metrics",
    responses={401: {"model": ErrorResponse}},
)
async def health_metrics(user: CurrentUser) -> dict[str, Any]:
    return await get_health_metrics()


@router.get(
    "/anomalies",
    summary="Detected anomalies",
    responses={401: {"model": ErrorResponse}},
)
async def anomalies_endpoint(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return await get_anomalies(limit)


@router.get(
    "/recovery",
    summary="Recovery action history",
    responses={401: {"model": ErrorResponse}},
)
async def recovery_history(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return await get_recovery_history(limit)


@router.post(
    "/recover",
    summary="Trigger manual recovery for a component",
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def manual_recover(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    component = body.get("component", "")
    if not component:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="component is required",
        )
    return await recover_component(component)


@router.post(
    "/replay-dlq",
    summary="Replay dead-letter queue entries",
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def replay_dlq(user: RequireOwnerAdmin) -> dict[str, Any]:
    return await replay_dead_letters()
