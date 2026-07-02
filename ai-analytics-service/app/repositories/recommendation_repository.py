"""
Repository for recommendation engine queries.

Read-only queries for co-occurrence analysis and item name lookups.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import func, select

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_order_item_pairs(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Fetch all item pairs that co-occur in the same order for association rule mining.

    Returns rows with: item_a, item_b (menu_item_id pairs)
    """
    from app.models import MenuItem, Order, OrderItem

    # Self-join OrderItem on order_id, where item_a < item_b to avoid duplicates
    oi1 = OrderItem.__table__.alias("oi1")
    oi2 = OrderItem.__table__.alias("oi2")

    stmt = (
        select(
            oi1.c.menu_item_id.label("item_a"),
            oi2.c.menu_item_id.label("item_b"),
        )
        .select_from(oi1)
        .join(oi2, oi1.c.order_id == oi2.c.order_id)
        .join(Order, oi1.c.order_id == Order.id)
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
            func.date(Order.created_at) >= start_date,
            func.date(Order.created_at) <= end_date,
            oi1.c.menu_item_id < oi2.c.menu_item_id,
        )
    )

    result = await db.execute(stmt)
    return [{"item_a": str(row.item_a), "item_b": str(row.item_b)} for row in result.fetchall()]


async def fetch_item_names(
    db: "AsyncSession",
    item_ids: list[str],
) -> dict[str, str]:
    """Fetch item names for a list of menu item IDs."""
    from app.models import MenuItem

    if not item_ids:
        return {}

    stmt = select(MenuItem.id, MenuItem.name).where(MenuItem.id.in_(item_ids))
    result = await db.execute(stmt)
    return {str(row.id): row.name for row in result.fetchall()}