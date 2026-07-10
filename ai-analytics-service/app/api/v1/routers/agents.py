"""Agents router — multi-agent AI system endpoints.

Milestone 11: Multi-Agent AI System.

Endpoints:
    GET  /api/v1/agents           — List all agents
    GET  /api/v1/agents/status    — Agent health status
    GET  /api/v1/agents/metrics   — System-wide agent metrics
    GET  /api/v1/agents/tasks     — Recent task history
    GET  /api/v1/agents/history   — Message history
    POST /api/v1/agents/run       — Submit a request to the coordinator
    POST /api/v1/agents/restart   — Restart a failed agent
    POST /api/v1/agents/message   — Send inter-agent message
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.config.security import CurrentUser, RequireOwnerAdmin, resolve_tenant_id
from app.schemas import ErrorResponse
from app.services.agent_service import (
    get_agent_history,
    get_agent_metrics,
    get_agent_status,
    get_agent_tasks,
    get_agents,
    restart_agent,
    run_agent_request,
    send_agent_message,
)

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get(
    "",
    summary="List all agents",
    responses={401: {"model": ErrorResponse}},
)
async def list_agents(user: CurrentUser) -> list[dict[str, Any]]:
    return await get_agents()


@router.get(
    "/status",
    summary="Agent health status",
    responses={401: {"model": ErrorResponse}},
)
async def agent_status(user: CurrentUser) -> list[dict[str, Any]]:
    return await get_agent_status()


@router.get(
    "/metrics",
    summary="System-wide agent metrics",
    responses={401: {"model": ErrorResponse}},
)
async def agent_metrics(user: CurrentUser) -> dict[str, Any]:
    return await get_agent_metrics()


@router.get(
    "/tasks",
    summary="Recent agent tasks",
    responses={401: {"model": ErrorResponse}},
)
async def agent_tasks(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[dict[str, Any]]:
    return await get_agent_tasks(limit=limit)


@router.get(
    "/history",
    summary="Agent message history",
    responses={401: {"model": ErrorResponse}},
)
async def agent_history(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[dict[str, Any]]:
    return await get_agent_history(limit=limit)


@router.post(
    "/run",
    summary="Submit a request to the agent coordinator",
    responses={401: {"model": ErrorResponse}},
)
async def run_request(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    request_text = body.get("request", "")
    if not request_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="request is required")

    return await run_agent_request(
        request=request_text,
        restaurant_id=resolve_tenant_id(user, body.get("restaurant_id")),
        user_id=user.id,
    )


@router.post(
    "/restart",
    summary="Restart a failed agent",
    responses={401: {"model": ErrorResponse}},
)
async def restart(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    agent_id = body.get("agent_id", "")
    if not agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent_id is required")

    success = await restart_agent(agent_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found")
    return {"agent_id": agent_id, "restarted": True}


@router.post(
    "/message",
    summary="Send an inter-agent message",
    responses={401: {"model": ErrorResponse}},
)
async def message(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    from_agent = body.get("from_agent", "")
    to_agent = body.get("to_agent", "")
    action = body.get("action", "")
    if not to_agent or not action:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="to_agent and action are required")

    result = await send_agent_message(
        from_agent=from_agent or "user",
        to_agent=to_agent,
        action=action,
        payload=body.get("payload", {}),
    )
    return {"delivered": result is not None, "response": result}
