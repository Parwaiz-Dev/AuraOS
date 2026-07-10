"""Insights router — daily insights, weekly reports, and history endpoints.

Milestone 6: Proactive AI Assistant and Autonomous Insights.

Endpoints:
    GET /api/v1/insights/daily   — Generate today's insights
    GET /api/v1/insights/weekly  — Generate weekly AI report
    GET /api/v1/insights/history — Retrieve stored insight history
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser, TokenPayload, resolve_tenant_id
from app.schemas import (
    ErrorResponse,
    InsightHistoryResponse,
    InsightResponse,
    WeeklyReportResponse,
)
from app.services.insight_service import (
    get_daily_insights,
    get_history,
    get_weekly_report,
)

router = APIRouter(prefix="/insights")


@router.get(
    "/daily",
    response_model=InsightResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Generate daily insights",
    description="Runs all detection engines (anomaly, trend, opportunity, risk) "
    "and returns a comprehensive daily insight report for the authenticated restaurant.",
)
async def daily_insights(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate today's insights for the authenticated restaurant."""
    result = await get_daily_insights(
        db=db,
        restaurant_id=user.restaurantId,
        restaurant_name="Your restaurant",
    )
    return result


@router.get(
    "/weekly",
    response_model=WeeklyReportResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Generate weekly AI report",
    description="Generates a comprehensive weekly report aggregating all detection "
    "engines. Includes trend analysis, anomaly summary, and recommendations.",
)
async def weekly_report(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a weekly AI report for the authenticated restaurant."""
    result = await get_weekly_report(
        db=db,
        restaurant_id=user.restaurantId,
        restaurant_name="Your restaurant",
    )
    return result


@router.get(
    "/history",
    response_model=InsightHistoryResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Get insight history",
    description="Returns previously generated insight entries from the in-memory "
    "history store. Optionally filter by restaurant_id.",
)
async def history(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200, description="Maximum entries to return"),
    restaurant_id: str | None = Query(
        default=None,
        description="Filter by restaurant ID (defaults to authenticated restaurant)",
    ),
) -> dict:
    """Retrieve stored insight history."""
    rid = resolve_tenant_id(user, restaurant_id)
    entries = await get_history(restaurant_id=rid, limit=limit)
    return {"entries": entries, "total": len(entries)}