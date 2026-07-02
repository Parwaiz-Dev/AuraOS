"""Inventory tool — wraps the inventory prediction service."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def inventory_tool(db: "AsyncSession", restaurant_id: str) -> dict[str, Any]:
    """Gather inventory depletion predictions and reorder recommendations."""
    from app.services.inventory_service import get_inventory_predictions

    try:
        predictions = await get_inventory_predictions(db, restaurant_id) or []
    except Exception:
        logger.debug("inventory_tool: predictions failed", exc_info=True)
        predictions = []

    at_risk = [p for p in predictions if p.get("needsReorder")]

    return {
        "total_items": len(predictions),
        "items_needing_reorder": len(at_risk),
        "at_risk_items": [
            {
                "name": p.get("name"),
                "current_stock": p.get("currentStock"),
                "days_remaining": p.get("daysRemaining"),
                "reorder_quantity": p.get("reorderQuantity"),
                "depletion_date": p.get("depletionDate"),
            }
            for p in at_risk[:10]
        ],
    }
