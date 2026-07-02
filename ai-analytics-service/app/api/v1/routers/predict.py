"""Predict API router — Wait time and inventory prediction endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser
from app.schemas import (
    ErrorResponse,
    InventoryPrediction,
    WaitTimeEstimate,
)
from app.services.inventory_service import get_inventory_predictions
from app.services.wait_time_service import get_wait_time

router = APIRouter(prefix="/predict", tags=["Prediction"])


@router.get(
    "/wait-time",
    response_model=WaitTimeEstimate,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    summary="Predict wait time",
    description="Estimate current food preparation wait time based on active orders, table occupancy, and kitchen load using XGBoost.",
)
async def predict_wait_time(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WaitTimeEstimate:
    """Return estimated wait time in minutes."""
    result = await get_wait_time(db, current_user.restaurantId)

    if result is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Insufficient data to predict wait time. More order history is needed.",
        )

    return WaitTimeEstimate(**result)


@router.get(
    "/inventory",
    response_model=list[InventoryPrediction],
    responses={401: {"model": ErrorResponse}},
    summary="Predict inventory depletion",
    description="Predict when inventory items will deplete and recommend reorder dates based on historical consumption rates.",
)
async def predict_inventory(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    item_ids: Annotated[
        str | None,
        Query(description="Comma-separated inventory item IDs to filter predictions"),
    ] = None,
) -> list[InventoryPrediction]:
    """Return inventory depletion predictions and reorder recommendations."""
    parsed_ids = None
    if item_ids:
        parsed_ids = [i.strip() for i in item_ids.split(",") if i.strip()]

    result = await get_inventory_predictions(
        db, current_user.restaurantId, item_ids=parsed_ids,
    )

    if result is None:
        return []

    return [InventoryPrediction(**item) for item in result]