"""
Dashboard repository — queries for the unified dashboard endpoint.

All queries are tenant-scoped and read-only.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, cast, extract, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Customer, MenuItem, Order, OrderItem, Payment


# ── Today's KPIs ─────────────────────────────────────────────────────────────────


async def fetch_today_kpis(
    db: AsyncSession,
    restaurant_id: UUID,
) -> dict:
    """Return today's key metrics: total/cancelled/completed orders, revenue, AOV."""
    today = date.today()

    stmt = select(
        func.count(Order.id).label("total_orders"),
        func.coalesce(
            func.sum(
                func.case((Order.status == "CANCELLED", 1), else_=0)
            ), 0
        ).label("cancelled_orders"),
        func.coalesce(
            func.sum(
                func.case((Order.status == "COMPLETED", 1), else_=0)
            ), 0
        ).label("completed_orders"),
        func.coalesce(
            func.sum(
                func.case((Order.status == "COMPLETED", Order.total_amount), else_=0)
            ), 0
        ).label("total_revenue"),
        func.coalesce(
            func.sum(
                func.case((Order.status == "COMPLETED", Order.total_amount), else_=0)
            ) / func.nullif(
                func.sum(
                    func.case((Order.status == "COMPLETED", 1), else_=0)
                ), 0
            ), 0
        ).label("average_order_value"),
    ).where(
        Order.restaurant_id == restaurant_id,
        cast(Order.created_at, Date) == today,
    )

    result = await db.execute(stmt)
    row = dict(result.mappings().first() or {})

    return {
        "totalOrders": int(row.get("total_orders", 0)),
        "completedOrders": int(row.get("completed_orders", 0)),
        "cancelledOrders": int(row.get("cancelled_orders", 0)),
        "totalRevenue": float(row.get("total_revenue", 0)),
        "averageOrderValue": float(row.get("average_order_value", 0)),
    }


# ── Active customers ─────────────────────────────────────────────────────────────


async def fetch_active_customers(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    days: int = 30,
) -> int:
    """Count distinct customers who placed orders in the last N days."""
    stmt = select(func.count(func.distinct(Order.customer_id))).where(
        Order.restaurant_id == restaurant_id,
        Order.customer_id.isnot(None),
        Order.created_at >= func.now() - text(f"INTERVAL '{days} days'"),
    )

    result = await db.execute(stmt)
    return result.scalar_one() or 0


# ── Repeat customers ─────────────────────────────────────────────────────────────


async def fetch_repeat_customers(
    db: AsyncSession,
    restaurant_id: UUID,
) -> int:
    """Count customers with 2+ orders (all-time)."""
    sub = (
        select(Order.customer_id, func.count(Order.id).label("order_count"))
        .where(
            Order.restaurant_id == restaurant_id,
            Order.customer_id.isnot(None),
        )
        .group_by(Order.customer_id)
        .having(func.count(Order.id) >= 2)
        .subquery()
    )

    stmt = select(func.count()).select_from(sub)
    result = await db.execute(stmt)
    return result.scalar_one() or 0


# ── Peak hour today ──────────────────────────────────────────────────────────────


async def fetch_peak_hour_today(
    db: AsyncSession,
    restaurant_id: UUID,
) -> int | None:
    """Return the hour (0-23) with the most orders today."""
    today = date.today()

    stmt = (
        select(
            extract("hour", Order.created_at).label("hour"),
            func.count(Order.id).label("cnt"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) == today,
        )
        .group_by(extract("hour", Order.created_at))
        .order_by(func.count(Order.id).desc())
        .limit(1)
    )

    result = await db.execute(stmt)
    row = result.mappings().first()
    return int(row["hour"]) if row else None


# ── Top selling item today ───────────────────────────────────────────────────────


async def fetch_top_selling_item_today(
    db: AsyncSession,
    restaurant_id: UUID,
) -> dict | None:
    """Return the most-sold menu item today."""
    today = date.today()

    stmt = (
        select(
            MenuItem.name,
            func.sum(OrderItem.quantity).label("quantity_sold"),
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .where(
            OrderItem.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) == today,
        )
        .group_by(MenuItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(1)
    )

    result = await db.execute(stmt)
    row = result.mappings().first()
    if row:
        return {"name": row["name"], "quantitySold": int(row["quantity_sold"])}
    return None


# ── Hourly sales chart ───────────────────────────────────────────────────────────


async def fetch_hourly_sales_today(
    db: AsyncSession,
    restaurant_id: UUID,
) -> dict:
    """Return hourly sales data for today's chart."""
    today = date.today()

    stmt = (
        select(
            extract("hour", Order.created_at).label("hour"),
            func.coalesce(
                func.sum(
                    func.case((Order.status == "COMPLETED", Order.total_amount), else_=0)
                ), 0
            ).label("revenue"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) == today,
        )
        .group_by(extract("hour", Order.created_at))
        .order_by(extract("hour", Order.created_at))
    )

    result = await db.execute(stmt)
    rows = result.mappings().all()

    # Build labels 0–23
    labels = [f"{h:02d}:00" for h in range(24)]
    values = [0.0] * 24
    for row in rows:
        h = int(row["hour"])
        values[h] = float(row["revenue"])

    return {"labels": labels, "values": values}


# ── Weekly sales chart ───────────────────────────────────────────────────────────


async def fetch_weekly_sales(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    weeks: int = 7,
) -> dict:
    """Return weekly sales for the last N weeks."""
    stmt = (
        select(
            func.to_char(func.date_trunc("week", Order.completed_at), "YYYY-MM-DD").label("week_start"),
            func.coalesce(
                func.sum(
                    func.case((Order.status == "COMPLETED", Order.total_amount), else_=0)
                ), 0
            ).label("revenue"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.completed_at.isnot(None),
        )
        .group_by(func.date_trunc("week", Order.completed_at))
        .order_by(func.date_trunc("week", Order.completed_at).desc())
        .limit(weeks)
    )

    result = await db.execute(stmt)
    rows = list(result.mappings().all())
    rows.reverse()  # chronological

    return {
        "labels": [r["week_start"] for r in rows],
        "values": [float(r["revenue"]) for r in rows],
    }


# ── Monthly sales chart ──────────────────────────────────────────────────────────


async def fetch_monthly_sales(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    months: int = 12,
) -> dict:
    """Return monthly sales for the last N months."""
    stmt = (
        select(
            func.to_char(func.date_trunc("month", Order.completed_at), "YYYY-MM").label("month"),
            func.coalesce(
                func.sum(
                    func.case((Order.status == "COMPLETED", Order.total_amount), else_=0)
                ), 0
            ).label("revenue"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.completed_at.isnot(None),
        )
        .group_by(func.date_trunc("month", Order.completed_at))
        .order_by(func.date_trunc("month", Order.completed_at).desc())
        .limit(months)
    )

    result = await db.execute(stmt)
    rows = list(result.mappings().all())
    rows.reverse()

    return {
        "labels": [r["month"] for r in rows],
        "values": [float(r["revenue"]) for r in rows],
    }