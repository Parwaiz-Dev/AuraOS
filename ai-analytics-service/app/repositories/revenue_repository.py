"""
Revenue repository — async SQLAlchemy queries for revenue aggregation.

Every query is tenant-scoped via ``restaurant_id`` and reads only
completed orders.  The session is already in READ ONLY mode (set by
the ``get_db`` dependency).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Date, cast, extract, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderItem, MenuItem, MenuCategory


# ── Daily revenue ────────────────────────────────────────────────────────────────


async def fetch_daily_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 90,
) -> list[dict]:
    """Return daily revenue rows: date, revenue, order_count, aov."""
    cols = [
        cast(Order.completed_at, Date).label("date"),
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        func.count(Order.id).label("order_count"),
        func.coalesce(
            func.sum(Order.total_amount) / func.nullif(func.count(Order.id), 0), 0
        ).label("average_order_value"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = (
        stmt.group_by(cast(Order.completed_at, Date))
        .order_by(cast(Order.completed_at, Date).desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result]


# ── Weekly revenue ───────────────────────────────────────────────────────────────


async def fetch_weekly_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 52,
) -> list[dict]:
    """Return weekly revenue rows: week_start, week_end, revenue, order_count."""
    # Use text() for the literal to avoid parameterization mismatch between
    # SELECT and GROUP BY (PostgreSQL can't determine $1 = $6).
    _week_trunc = func.date_trunc(text("'week'"), Order.completed_at)
    week_start = _week_trunc.label("week_start")
    week_end = (_week_trunc + text("INTERVAL '6 days'")).label("week_end")

    cols = [
        week_start,
        week_end,
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        func.count(Order.id).label("order_count"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = (
        stmt.group_by(_week_trunc)
        .order_by(_week_trunc.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = [dict(row._mapping) for row in result]

    # Compute growth_percentage for each row relative to previous week
    for i in range(len(rows)):
        if i < len(rows) - 1 and rows[i + 1]["revenue"]:
            prev = float(rows[i + 1]["revenue"])
            curr = float(rows[i]["revenue"])
            rows[i]["growth_percentage"] = round(((curr - prev) / prev) * 100, 2) if prev else None
        else:
            rows[i]["growth_percentage"] = None

    return rows


# ── Monthly revenue ──────────────────────────────────────────────────────────────


async def fetch_monthly_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 36,
) -> list[dict]:
    """Return monthly revenue rows: month (YYYY-MM), revenue, order_count."""
    # Use text() for the literal to avoid parameterization mismatch between
    # SELECT and GROUP BY (PostgreSQL can't determine $1 = $6).
    _month_trunc = func.date_trunc(text("'month'"), Order.completed_at)
    cols = [
        func.to_char(_month_trunc, text("'YYYY-MM'")).label("month"),
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        func.count(Order.id).label("order_count"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = (
        stmt.group_by(_month_trunc)
        .order_by(_month_trunc.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = [dict(row._mapping) for row in result]

    for i in range(len(rows)):
        if i < len(rows) - 1 and rows[i + 1]["revenue"]:
            prev = float(rows[i + 1]["revenue"])
            curr = float(rows[i]["revenue"])
            rows[i]["growth_percentage"] = round(((curr - prev) / prev) * 100, 2) if prev else None
        else:
            rows[i]["growth_percentage"] = None

    return rows


# ── Yearly revenue ───────────────────────────────────────────────────────────────


async def fetch_yearly_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    limit: int = 10,
) -> list[dict]:
    """Return yearly revenue rows: year, revenue, order_count."""
    cols = [
        extract("year", Order.completed_at).label("year"),
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        func.count(Order.id).label("order_count"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
        .group_by(extract("year", Order.completed_at))
        .order_by(extract("year", Order.completed_at).desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result]


# ── Peak hours ───────────────────────────────────────────────────────────────────


async def fetch_peak_hours(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Return orders grouped by hour-of-day: hour, order_count, revenue."""
    cols = [
        extract("hour", Order.completed_at).label("hour"),
        func.count(Order.id).label("order_count"),
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = stmt.group_by(extract("hour", Order.completed_at)).order_by(extract("hour", Order.completed_at))

    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result]


# ── Top days of week ─────────────────────────────────────────────────────────────


async def fetch_top_days(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Return revenue grouped by day-of-week: dow (0=Sun), order_count, revenue."""
    cols = [
        extract("dow", Order.completed_at).label("dow"),
        func.count(Order.id).label("order_count"),
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = stmt.group_by(extract("dow", Order.completed_at)).order_by(extract("dow", Order.completed_at))

    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result]


# ── Top months ───────────────────────────────────────────────────────────────────


async def fetch_top_months(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Return revenue grouped by month-number: month, order_count, revenue."""
    cols = [
        extract("month", Order.completed_at).label("month"),
        func.count(Order.id).label("order_count"),
        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
    ]

    stmt = (
        select(*cols)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status == "COMPLETED")
    )

    if start_date:
        stmt = stmt.where(Order.completed_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.completed_at <= end_date)

    stmt = stmt.group_by(extract("month", Order.completed_at)).order_by(extract("month", Order.completed_at))

    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result]


# ── Revenue trends (growth) ──────────────────────────────────────────────────────


async def fetch_revenue_trends(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    periods: int = 6,
) -> dict:
    """Return month-over-month growth percentages for the last N months."""
    monthly = await fetch_monthly_revenue(db, restaurant_id, limit=periods)

    growth_rates: list[dict] = []
    for i in range(len(monthly)):
        entry = dict(monthly[i])
        if i < len(monthly) - 1 and monthly[i + 1]["revenue"]:
            prev = float(monthly[i + 1]["revenue"])
            curr = float(monthly[i]["revenue"])
            growth = round(((curr - prev) / prev) * 100, 2) if prev else 0.0
        else:
            growth = 0.0
        growth_rates.append({
            "month": entry["month"],
            "revenue": float(entry["revenue"]),
            "order_count": int(entry["order_count"]),
            "growth_percentage": growth,
        })

    return {"trends": growth_rates, "periods": periods}