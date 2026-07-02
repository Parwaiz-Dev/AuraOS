"""Recommendations API router — Item recommendation endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser
from app.schemas import ErrorResponse, Recommendation
from app.services.recommendation_service import get_recommendations

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get(
    "/items",
    response_model=list[Recommendation],
    responses={401: {"model": ErrorResponse}},
    summary="Get item recommendations",
    description="Return recommended items based on association rules. Optionally filter by specific item IDs to get 'people who buy X also buy Y' recommendations.",
)
async def get_item_recommendations(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    item_ids: Annotated[
        str | None,
        Query(description="Comma-separated menu item IDs to base recommendations on"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=50, description="Max recommendations")] = 10,
) -> list[Recommendation]:
    """Return recommended items based on co-occurrence analysis."""
    parsed_ids = None
    if item_ids:
        parsed_ids = [i.strip() for i in item_ids.split(",") if i.strip()]

    result = await get_recommendations(
        db, current_user.restaurantId, item_ids=parsed_ids, limit=limit,
    )

    if result is None:
        return []

    return [Recommendation(**item) for item in result]