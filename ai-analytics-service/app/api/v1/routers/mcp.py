"""MCP router — tool discovery, execution, and registration.

Milestone 12: Model Context Protocol.

Endpoints:
    GET  /api/v1/mcp/tools        — List available MCP tools
    POST /api/v1/mcp/execute       — Execute an MCP tool
    POST /api/v1/mcp/register      — Register a custom tool
    GET  /api/v1/mcp/stats         — MCP execution statistics
    GET  /api/v1/mcp/log           — Recent execution log
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.config.security import CurrentUser, RequireOwnerAdmin
from app.schemas import ErrorResponse
from app.services.mcp_service import (
    execute_mcp_tool,
    get_mcp_execution_log,
    get_mcp_stats,
    list_mcp_tools,
    register_mcp_tool,
)

router = APIRouter(prefix="/mcp", tags=["MCP"])


@router.get(
    "/tools",
    summary="List available MCP tools",
    responses={401: {"model": ErrorResponse}},
)
async def list_tools(
    user: CurrentUser,
    category: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    return await list_mcp_tools(category)


@router.post(
    "/execute",
    summary="Execute an MCP tool",
    responses={401: {"model": ErrorResponse}},
)
async def execute_tool(
    body: dict[str, Any],
    user: CurrentUser,
) -> dict[str, Any]:
    tool_name = body.get("tool_name", "")
    if not tool_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tool_name is required",
        )
    return await execute_mcp_tool(
        tool_name,
        body.get("parameters", {}),
        user.role,
    )


@router.post(
    "/register",
    summary="Register a custom MCP tool",
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def register_tool(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    name = body.get("name", "")
    description = body.get("description", "")
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="name is required",
        )
    return await register_mcp_tool(
        name, description, body.get("category", "custom"),
    )


@router.get(
    "/stats",
    summary="MCP execution statistics",
    responses={401: {"model": ErrorResponse}},
)
async def mcp_stats(user: CurrentUser) -> dict[str, Any]:
    return await get_mcp_stats()


@router.get(
    "/log",
    summary="Recent MCP execution log",
    responses={401: {"model": ErrorResponse}},
)
async def mcp_log(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return await get_mcp_execution_log(limit)
