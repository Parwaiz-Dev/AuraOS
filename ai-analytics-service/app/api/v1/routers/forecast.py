"""Forecast API router — Revenue and Order forecasting endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser
from app.schemas import ErrorResponse, ForecastResponse
from app.services.order_forecast_service import get_order_forecast
from app.services.revenue_forecast_service import get_revenue_forecast

router = APIRouter(prefix="/forecast", tags=["Forecasting"])


@router.get(
    "/revenue",
    response_model=ForecastResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    summary="Forecast revenue",
    description="Predict daily revenue for the next N days using Prophet.",
)
async def forecast_revenue(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: Annotated[int, Query(ge=7, le=90, description="Forecast horizon in days")] = 30,
) -> ForecastResponse:
    """Return revenue forecast for the next *days*."""
    result = await get_revenue_forecast(db, current_user.restaurantId, days=days)

    if result is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Insufficient data to generate revenue forecast. At least 30 days of order history required.",
        )

    return ForecastResponse(**result)


@router.get(
    "/orders",
    response_model=ForecastResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    summary="Forecast order volume",
    description="Predict daily order counts for the next N days using Prophet.",
)
async def forecast_orders(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: Annotated[int, Query(ge=7, le=90, description="Forecast horizon in days")] = 30,
) -> ForecastResponse:
    """Return order count forecast for the next *days*."""
    result = await get_order_forecast(db, current_user.restaurantId, days=days)

    if result is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Insufficient data to generate order forecast. At least 30 days of order history required.",
        )

    return ForecastResponse(**result)