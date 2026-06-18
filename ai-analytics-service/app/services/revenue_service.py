"""
Revenue service — Pandas-based analytics on top of repository data.

Takes raw rows from the revenue repository and enriches them with
computed fields like growth percentages, peak hour analysis, and
top day/month detection.
"""

from __future__ import annotations

import logging
from uuid import UUID

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import revenue_repository

logger = logging.getLogger(__name__)

# Day-of-week mapping
_DOW_NAMES = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
]

# Month names
_MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


# ── Daily revenue ────────────────────────────────────────────────────────────────


async def get_daily_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 90,
) -> list[dict]:
    """Return daily revenue with computed fields."""
    raw = await revenue_repository.fetch_daily_revenue(
        db, restaurant_id, start_date=start_date, end_date=end_date, limit=limit,
    )

    if not raw:
        return []

    df = pd.DataFrame(raw)
    df = df.sort_values("date", ascending=False)

    result: list[dict] = []
    for i, (_, row) in enumerate(df.iterrows()):
        entry = {
            "date": str(row["date"]),
            "totalRevenue": float(row["revenue"]),
            "completedOrders": int(row["order_count"]),
            "averageOrderValue": round(float(row["average_order_value"]), 2),
            "growthPercentage": None,
            "peakHour": None,
            "topDay": None,
            "topMonth": None,
        }
        if i < len(df) - 1:
            prev = float(df.iloc[i + 1]["revenue"])
            curr = float(row["revenue"])
            if prev:
                entry["growthPercentage"] = round(((curr - prev) / prev) * 100, 2)
        result.append(entry)

    # Enrich with peak hour / top day / top month for the most recent day
    if result:
        peak_hours = await revenue_repository.fetch_peak_hours(db, restaurant_id, start_date=start_date, end_date=end_date)
        top_days = await revenue_repository.fetch_top_days(db, restaurant_id, start_date=start_date, end_date=end_date)
        top_months = await revenue_repository.fetch_top_months(db, restaurant_id, start_date=start_date, end_date=end_date)

        if peak_hours:
            ph = max(peak_hours, key=lambda x: x["order_count"])
            result[0]["peakHour"] = int(ph["hour"])

        if top_days:
            td = max(top_days, key=lambda x: x["revenue"])
            result[0]["topDay"] = _DOW_NAMES[int(td["dow"])]

        if top_months:
            tm = max(top_months, key=lambda x: x["revenue"])
            result[0]["topMonth"] = _MONTH_NAMES[int(tm["month"])]

    return result


# ── Weekly revenue ───────────────────────────────────────────────────────────────


async def get_weekly_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 52,
) -> list[dict]:
    """Return weekly revenue with growth percentages."""
    raw = await revenue_repository.fetch_weekly_revenue(
        db, restaurant_id, start_date=start_date, end_date=end_date, limit=limit,
    )

    return [
        {
            "weekStart": str(r["week_start"]),
            "weekEnd": str(r["week_end"]),
            "totalRevenue": float(r["revenue"]),
            "completedOrders": int(r["order_count"]),
            "averageOrderValue": round(
                float(r["revenue"]) / r["order_count"] if r["order_count"] else 0, 2
            ),
            "growthPercentage": r.get("growth_percentage"),
            "peakHour": None,
            "topDay": None,
            "topMonth": None,
        }
        for r in raw
    ]


# ── Monthly revenue ──────────────────────────────────────────────────────────────


async def get_monthly_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 36,
) -> list[dict]:
    """Return monthly revenue with growth percentages."""
    raw = await revenue_repository.fetch_monthly_revenue(
        db, restaurant_id, start_date=start_date, end_date=end_date, limit=limit,
    )

    response: list[dict] = []
    for i, r in enumerate(raw):
        entry = {
            "month": r["month"],
            "totalRevenue": float(r["revenue"]),
            "completedOrders": int(r["order_count"]),
            "averageOrderValue": round(
                float(r["revenue"]) / r["order_count"] if r["order_count"] else 0, 2
            ),
            "growthPercentage": r.get("growth_percentage"),
            "peakHour": None,
            "topDay": None,
            "topMonth": None,
        }
        response.append(entry)

    return response


# ── Yearly revenue ───────────────────────────────────────────────────────────────


async def get_yearly_revenue(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    limit: int = 10,
) -> list[dict]:
    """Return yearly revenue."""
    raw = await revenue_repository.fetch_yearly_revenue(
        db, restaurant_id, limit=limit,
    )

    return [
        {
            "year": int(r["year"]),
            "totalRevenue": float(r["revenue"]),
            "completedOrders": int(r["order_count"]),
            "averageOrderValue": round(
                float(r["revenue"]) / r["order_count"] if r["order_count"] else 0, 2
            ),
            "growthPercentage": None,
            "peakHour": None,
            "topDay": None,
            "topMonth": None,
        }
        for r in raw
    ]


# ── Revenue trends ───────────────────────────────────────────────────────────────


async def get_revenue_trends(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    periods: int = 6,
) -> dict:
    """Return month-over-month revenue growth trends."""
    return await revenue_repository.fetch_revenue_trends(
        db, restaurant_id, periods=periods,
    )


# ── Peak hours ───────────────────────────────────────────────────────────────────


async def get_peak_hours(
    db: AsyncSession,
    restaurant_id: UUID,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Return hourly order distribution."""
    raw = await revenue_repository.fetch_peak_hours(
        db, restaurant_id, start_date=start_date, end_date=end_date,
    )

    return [
        {
            "hour": int(r["hour"]),
            "orderCount": int(r["order_count"]),
            "revenue": float(r["revenue"]),
        }
        for r in raw
    ]