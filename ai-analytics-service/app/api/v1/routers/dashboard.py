"""
Dashboard router — unified endpoint that returns KPIs, charts, and top items.

Cached via Redis (TTL 300s) with graceful fallback to live queries.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser
from app.services import dashboard_service

router = APIRouter(
    tags=["Dashboard"],
)


@router.get("/dashboard", summary="Unified dashboard endpoint")
async def dashboard(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all dashboard KPIs, charts, and top items.

    The response is cached in Redis for 5 minutes per restaurant.
    If Redis is unavailable, the endpoint still works — it just
    queries the database on every request.
    """
    return await dashboard_service.get_dashboard(
        db,
        UUID(current_user.restaurantId),
    )