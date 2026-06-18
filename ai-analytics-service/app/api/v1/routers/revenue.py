"""
Revenue analytics router — daily, weekly, monthly, yearly, and trends endpoints.

All endpoints are tenant-scoped via the JWT ``restaurantId`` claim.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser, TokenPayload
from app.services import revenue_service

router = APIRouter(
    prefix="/analytics/revenue",
    tags=["Revenue Analytics"],
)


@router.get("/daily", summary="Daily revenue breakdown")
async def daily_revenue(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    limit: int = Query(90, ge=1, le=365, description="Max days to return"),
) -> list[dict]:
    """Return daily revenue for the authenticated restaurant."""
    return await revenue_service.get_daily_revenue(
        db,
        UUID(current_user.restaurantId),
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get("/weekly", summary="Weekly revenue breakdown")
async def weekly_revenue(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    limit: int = Query(52, ge=1, le=104, description="Max weeks to return"),
) -> list[dict]:
    """Return weekly revenue with growth percentages."""
    return await revenue_service.get_weekly_revenue(
        db,
        UUID(current_user.restaurantId),
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get("/monthly", summary="Monthly revenue breakdown")
async def monthly_revenue(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    limit: int = Query(36, ge=1, le=60, description="Max months to return"),
) -> list[dict]:
    """Return monthly revenue with growth percentages."""
    return await revenue_service.get_monthly_revenue(
        db,
        UUID(current_user.restaurantId),
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get("/yearly", summary="Yearly revenue breakdown")
async def yearly_revenue(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=20, description="Max years to return"),
) -> list[dict]:
    """Return yearly revenue."""
    return await revenue_service.get_yearly_revenue(
        db,
        UUID(current_user.restaurantId),
        limit=limit,
    )


@router.get("/trends", summary="Month-over-month revenue trends")
async def revenue_trends(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    periods: int = Query(6, ge=2, le=24, description="Months to trend"),
) -> dict:
    """Return month-over-month growth rates."""
    return await revenue_service.get_revenue_trends(
        db,
        UUID(current_user.restaurantId),
        periods=periods,
    )


@router.get("/peak-hours", summary="Peak hour distribution")
async def peak_hours(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
) -> list[dict]:
    """Return hourly order distribution."""
    return await revenue_service.get_peak_hours(
        db,
        UUID(current_user.restaurantId),
        start_date=start_date,
        end_date=end_date,
    )