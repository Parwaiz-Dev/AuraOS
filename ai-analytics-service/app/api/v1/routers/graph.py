"""Graph router — LangGraph orchestration endpoints.

Milestone 12: LangGraph.

Endpoints:
    GET  /api/v1/graph              — List available graphs
    GET  /api/v1/graph/status       — Graph execution status & stats
    POST /api/v1/graph/run          — Run a graph
    GET  /api/v1/graph/history      — Execution history
    GET  /api/v1/graph/{graph_id}   — Graph topology
    GET  /api/v1/graph/{graph_id}/visualize — Mermaid visualization
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.config.security import CurrentUser, RequireOwnerAdmin, resolve_tenant_id
from app.schemas import ErrorResponse
from app.services.graph_service import (
    get_graph_history,
    get_graph_status,
    get_graph_topology,
    get_graph_visualization,
    list_available_graphs,
    run_graph,
)

router = APIRouter(prefix="/graph", tags=["LangGraph"])


@router.get(
    "",
    summary="List available graphs",
    responses={401: {"model": ErrorResponse}},
)
async def list_graphs_endpoint(user: CurrentUser) -> list[dict[str, Any]]:
    return await list_available_graphs()


@router.get(
    "/status",
    summary="Graph execution status and statistics",
    responses={401: {"model": ErrorResponse}},
)
async def graph_status(user: CurrentUser) -> dict[str, Any]:
    return await get_graph_status()


@router.post(
    "/run",
    summary="Run a graph",
    responses={401: {"model": ErrorResponse}},
)
async def run_graph_endpoint(
    body: dict[str, Any],
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    graph_id = body.get("graph_id", "")
    if not graph_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="graph_id is required",
        )
    return await run_graph(
        graph_id,
        restaurant_id=resolve_tenant_id(user, body.get("restaurant_id")),
        user_id=user.id,
        query=body.get("query", ""),
        context=body.get("context"),
        timeout=body.get("timeout", 300.0),
    )


@router.get(
    "/history",
    summary="Graph execution history",
    responses={401: {"model": ErrorResponse}},
)
async def graph_history(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return await get_graph_history(limit)


@router.get(
    "/{graph_id}",
    summary="Get graph topology",
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def graph_topology(graph_id: str, user: CurrentUser) -> dict[str, Any]:
    result = await get_graph_topology(graph_id)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"],
        )
    return result


@router.get(
    "/{graph_id}/visualize",
    summary="Get graph visualization (Mermaid)",
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def graph_visualize(graph_id: str, user: CurrentUser) -> dict[str, Any]:
    result = await get_graph_visualization(graph_id)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"],
        )
    return result
