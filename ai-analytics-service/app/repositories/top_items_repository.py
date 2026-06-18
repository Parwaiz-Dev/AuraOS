"""
Top Items repository — queries for best-selling items, categories, and
frequently-bought-together pairs (SQL-only aggregation, no ML).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MenuCategory, MenuItem, Order, OrderItem


# ── Top items ────────────────────────────────────────────────────────────────────


async def fetch_top_items(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 20,
    order_by: str = "revenue",  # "revenue" | "quantity"
) -> list[dict]:
    """Return top-selling items ranked by revenue or quantity sold."""
    quantity_col = func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity_sold")
    revenue_col = func.coalesce(
        func.sum(OrderItem.quantity * OrderItem.unit_price), 0
    ).label("revenue")

    stmt = (
        select(
            MenuItem.id.label("menu_item_id"),
            MenuItem.name.label("item_name"),
            MenuCategory.name.label("category_name"),
            quantity_col,
            revenue_col,
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .where(
            OrderItem.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
        )
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = stmt.group_by(MenuItem.id, MenuItem.name, MenuCategory.name)

    if order_by == "revenue":
        stmt = stmt.order_by(revenue_col.desc())
    else:
        stmt = stmt.order_by(quantity_col.desc())

    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    rows = result.mappings().all()

    return [
        {
            "itemName": r["item_name"],
            "quantitySold": int(r["quantity_sold"]),
            "revenue": float(r["revenue"]),
            "profit": None,  # profit requires cost data — placeholder for future
            "categoryName": r["category_name"],
        }
        for r in rows
    ]


# ── Top categories ───────────────────────────────────────────────────────────────


async def fetch_top_categories(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Return top categories by revenue and quantity sold."""
    stmt = (
        select(
            MenuCategory.id.label("category_id"),
            MenuCategory.name.label("category_name"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity_sold"),
            func.coalesce(
                func.sum(OrderItem.quantity * OrderItem.unit_price), 0
            ).label("revenue"),
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .where(
            OrderItem.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
        )
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = (
        stmt.group_by(MenuCategory.id, MenuCategory.name)
        .order_by(
            func.coalesce(
                func.sum(OrderItem.quantity * OrderItem.unit_price), 0
            ).desc()
        )
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.mappings().all()

    return [
        {
            "categoryName": r["category_name"],
            "quantitySold": int(r["quantity_sold"]),
            "revenue": float(r["revenue"]),
        }
        for r in rows
    ]


# ── Frequently bought together (SQL-only) ────────────────────────────────────────


async def fetch_frequently_bought_together(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    limit: int = 20,
) -> list[dict]:
    """Find pairs of items that frequently appear in the same order.

    Uses a self-join on order_items to find co-occurring items within the
    same order.  No ML — pure SQL aggregation.
    """
    oi1 = OrderItem.__table__.alias("oi1")
    oi2 = OrderItem.__table__.alias("oi2")
    mi1 = MenuItem.__table__.alias("mi1")
    mi2 = MenuItem.__table__.alias("mi2")

    # Build the FROM clause with explicit joins
    stmt = (
        select(
            mi1.c.name.label("item_a"),
            mi2.c.name.label("item_b"),
            func.count().label("frequency"),
        )
        .select_from(
            oi1.join(
                oi2,
                (oi1.c.order_id == oi2.c.order_id)
                & (oi1.c.menu_item_id < oi2.c.menu_item_id),
            )
            .join(mi1, oi1.c.menu_item_id == mi1.c.id)
            .join(mi2, oi2.c.menu_item_id == mi2.c.id)
        )
        .where(oi1.c.restaurant_id == restaurant_id)
        .group_by(mi1.c.name, mi2.c.name)
        .order_by(func.count().desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.mappings().all()

    return [
        {
            "itemA": r["item_a"],
            "itemB": r["item_b"],
            "frequency": int(r["frequency"]),
        }
        for r in rows
    ]