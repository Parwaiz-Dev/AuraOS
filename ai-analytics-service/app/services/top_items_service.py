"""
Top Items service — business logic for top items, categories, and
frequently-bought-together pairs.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import top_items_repository

logger = logging.getLogger(__name__)


async def get_top_items(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 20,
    order_by: str = "revenue",
) -> list[dict]:
    """Return top-selling items ranked by revenue or quantity."""
    return await top_items_repository.fetch_top_items(
        db, restaurant_id,
        start_date=start_date, end_date=end_date,
        limit=limit, order_by=order_by,
    )


async def get_top_categories(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Return top categories by revenue."""
    return await top_items_repository.fetch_top_categories(
        db, restaurant_id,
        start_date=start_date, end_date=end_date,
        limit=limit,
    )


async def get_frequently_bought_together(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    limit: int = 20,
) -> list[dict]:
    """Return frequently co-occurring item pairs (SQL aggregation)."""
    return await top_items_repository.fetch_frequently_bought_together(
        db, restaurant_id, limit=limit,
    )