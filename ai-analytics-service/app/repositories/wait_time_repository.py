"""
Repository for wait time prediction queries.

Read-only queries for kitchen metrics and historical wait time data.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import func, select, text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_wait_time_training_data(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Fetch historical order data with computed feature columns for XGBoost training.

    Returns rows with: active_orders, table_occupancy, kitchen_load, hour,
    day_of_week, is_weekend, actual_wait_minutes
    """
    from app.models import Order

    # Extract training features from completed orders
    # actual_wait_minutes = EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
    stmt = (
        select(
            func.coalesce(
                func.extract(
                    "epoch",
                    Order.completed_at - Order.created_at,
                ) / 60.0,
                0,
            ).label("actual_wait_minutes"),
            func.extract("hour", Order.created_at).label("hour"),
            func.extract("dow", Order.created_at).label("day_of_week"),
            func.count(Order.id).over().label("_total"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
            Order.completed_at.isnot(None),
            func.date(Order.created_at) >= start_date,
            func.date(Order.created_at) <= end_date,
        )
    )

    result = await db.execute(stmt)
    rows = result.fetchall()

    if not rows:
        return []

    total_orders = len(rows)

    # Compute approximate kitchen load and table occupancy from context
    output = []
    for i, row in enumerate(rows):
        hour = int(row.hour)
        day_of_week = int(row.day_of_week)
        is_weekend = 1 if day_of_week in (0, 5, 6) else 0  # Sun=0, Fri=5, Sat=6

        # Approximate kitchen load: number of orders in the same hour window
        kitchen_load = sum(1 for r in rows if abs(int(r.hour) - hour) <= 1)

        # Approximate table occupancy: percentage of orders in this hour
        table_occupancy = round(kitchen_load / max(total_orders, 1), 2)

        output.append({
            "active_orders": kitchen_load,
            "table_occupancy": table_occupancy,
            "kitchen_load": kitchen_load,
            "hour": hour,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "actual_wait_minutes": float(row.actual_wait_minutes),
        })

    return output


async def fetch_current_kitchen_metrics(
    db: "AsyncSession",
    restaurant_id: str,
) -> dict | None:
    """
    Fetch current kitchen metrics for real-time wait time prediction.

    Returns: {active_orders, table_occupancy, kitchen_load}
    """
    from app.models import Order

    now = datetime.now()

    # Active orders (not completed, not cancelled)
    active_stmt = (
        select(func.count(Order.id))
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status.in_(["PENDING", "PREPARING", "READY"]),
        )
    )
    active_result = await db.execute(active_stmt)
    active_orders = active_result.scalar() or 0

    # Total orders today for occupancy estimation
    today_stmt = (
        select(func.count(Order.id))
        .where(
            Order.restaurant_id == restaurant_id,
            func.date(Order.created_at) == func.current_date(),
        )
    )
    today_result = await db.execute(today_stmt)
    total_today = today_result.scalar() or 1

    # Estimate kitchen load from active orders
    kitchen_load = active_orders * 2  # rough multiplier

    table_occupancy = round(min(active_orders / max(total_today, 1), 1.0), 2)

    return {
        "active_orders": active_orders,
        "table_occupancy": table_occupancy,
        "kitchen_load": kitchen_load,
    }