"""
Repository for inventory prediction queries.

Read-only queries for inventory transaction history.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import func, select

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_inventory_transactions(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Fetch inventory transactions with item metadata for consumption rate calculation.

    Returns rows with: item_id, item_name, unit, quantity_change, current_stock
    """
    from app.models import InventoryItem, InventoryTransaction

    stmt = (
        select(
            InventoryTransaction.inventory_item_id.label("item_id"),
            InventoryItem.name.label("item_name"),
            InventoryItem.unit.label("unit"),
            InventoryTransaction.quantity_change,
            InventoryItem.quantity.label("current_stock"),
        )
        .select_from(InventoryTransaction)
        .join(InventoryItem, InventoryTransaction.inventory_item_id == InventoryItem.id)
        .where(
            InventoryItem.restaurant_id == restaurant_id,
            func.date(InventoryTransaction.created_at) >= start_date,
            func.date(InventoryTransaction.created_at) <= end_date,
        )
    )

    result = await db.execute(stmt)
    return [
        {
            "item_id": row.item_id,
            "item_name": row.item_name,
            "unit": row.unit or "units",
            "quantity_change": float(row.quantity_change),
            "current_stock": float(row.current_stock),
        }
        for row in result.fetchall()
    ]