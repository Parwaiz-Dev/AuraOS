"""Customers API router — Customer segmentation endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser
from app.schemas import CustomerSegmentAssignment, ErrorResponse
from app.services.customer_segmentation_service import get_customer_segments

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get(
    "/segments",
    response_model=list[CustomerSegmentAssignment],
    responses={401: {"model": ErrorResponse}},
    summary="Get customer segments",
    description="Classify all customers into segments (VIP, Loyal, Regular, At Risk, Lost) using KMeans clustering on RFM features.",
)
async def customer_segments(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CustomerSegmentAssignment]:
    """Return all customers with their assigned segment."""
    result = await get_customer_segments(db, current_user.restaurantId)

    if result is None:
        return []

    return [CustomerSegmentAssignment(**item) for item in result]