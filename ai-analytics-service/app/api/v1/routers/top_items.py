"""
Top Items router — best-selling items, categories, and frequently-bought-together pairs.

All queries are tenant-scoped and SQL-only (no ML).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser
from app.services import top_items_service

router = APIRouter(
    prefix="/analytics",
    tags=["Top Items"],
)


@router.get("/top-items", summary="Top selling items")
async def top_items(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    limit: int = Query(20, ge=1, le=100, description="Max items to return"),
    order_by: str = Query("revenue", regex="^(revenue|quantity)$", description="Sort by revenue or quantity"),
) -> list[dict]:
    """Return top-selling items ranked by revenue or quantity sold."""
    return await top_items_service.get_top_items(
        db,
        UUID(current_user.restaurantId),
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        order_by=order_by,
    )


@router.get("/top-categories", summary="Top categories")
async def top_categories(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    limit: int = Query(20, ge=1, le=100, description="Max categories to return"),
) -> list[dict]:
    """Return top categories by revenue."""
    return await top_items_service.get_top_categories(
        db,
        UUID(current_user.restaurantId),
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get("/frequently-bought-together", summary="Frequently bought together")
async def frequently_bought_together(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100, description="Max pairs to return"),
) -> list[dict]:
    """Return pairs of items that frequently appear in the same order.

    This is pure SQL aggregation — no ML model is used (yet).
    """
    return await top_items_service.get_frequently_bought_together(
        db,
        UUID(current_user.restaurantId),
        limit=limit,
    )