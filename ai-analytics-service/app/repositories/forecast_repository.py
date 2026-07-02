"""
Repository for forecast-related database queries.

Read-only queries that fetch historical data for Prophet model training.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import func, select, text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_daily_revenue_history(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Fetch daily revenue totals for Prophet training (ds, y)."""
    from app.models import Order

    stmt = (
        select(
            func.date(Order.created_at).label("ds"),
            func.coalesce(func.sum(Order.total_amount), 0).label("y"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
            func.date(Order.created_at) >= start_date,
            func.date(Order.created_at) <= end_date,
        )
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )

    result = await db.execute(stmt)
    return [{"ds": str(row.ds), "y": float(row.y)} for row in result.fetchall()]


async def fetch_daily_order_counts(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Fetch daily order counts for Prophet training (ds, y)."""
    from app.models import Order

    stmt = (
        select(
            func.date(Order.created_at).label("ds"),
            func.count(Order.id).label("y"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            func.date(Order.created_at) >= start_date,
            func.date(Order.created_at) <= end_date,
        )
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )

    result = await db.execute(stmt)
    return [{"ds": str(row.ds), "y": int(row.y)} for row in result.fetchall()]