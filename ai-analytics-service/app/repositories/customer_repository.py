"""
Repository for customer-related database queries.

Read-only queries for RFM analysis and customer segmentation.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import func, select, text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_customer_rfm(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    reference_date: date,
    lookback_days: int = 365,
) -> list[dict]:
    """
    Fetch RFM (Recency, Frequency, Monetary) values for each customer.

    Returns rows with: customer_id, name, recency_days, frequency, monetary
    """
    from app.models import Customer, Order

    # Subquery: per-customer order aggregates
    order_agg = (
        select(
            Order.customer_id,
            func.max(Order.created_at).label("last_order"),
            func.count(Order.id).label("frequency"),
            func.coalesce(func.sum(Order.total_amount), 0).label("monetary"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
            Order.customer_id.isnot(None),
        )
        .group_by(Order.customer_id)
    ).subquery()

    stmt = (
        select(
            Customer.id.label("customer_id"),
            Customer.name,
            func.coalesce(
                func.extract("day", text(f"DATE '{reference_date}'") - order_agg.c.last_order),
                9999,
            ).label("recency_days"),
            func.coalesce(order_agg.c.frequency, 0).label("frequency"),
            func.coalesce(order_agg.c.monetary, 0).label("monetary"),
        )
        .select_from(Customer)
        .outerjoin(order_agg, Customer.id == order_agg.c.customer_id)
        .where(Customer.restaurant_id == restaurant_id)
    )

    result = await db.execute(stmt)
    rows = []
    for row in result.fetchall():
        rows.append({
            "customer_id": row.customer_id,
            "name": row.name or "Unknown",
            "recency_days": int(row.recency_days),
            "frequency": int(row.frequency),
            "monetary": float(row.monetary),
        })
    return rows