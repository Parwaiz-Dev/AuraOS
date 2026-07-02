"""Predictor for Inventory — predicts depletion dates and reorder recommendations."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

from app.ml.inventory_prediction.model_manager import get_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def predict_inventory(
    restaurant_id: str,
    *,
    item_ids: list[str] | None = None,
    db: "AsyncSession | None" = None,
) -> list[dict] | None:
    """
    Predict depletion dates and reorder recommendations for inventory items.

    Returns list of {itemId, name, currentStock, dailyRate, depletionDate, reorderDate, reorderQuantity}
    """
    rates = get_model(restaurant_id)
    if rates is None:
        logger.info("No cached inventory model for %s; attempting auto-train", restaurant_id)
        if db is not None:
            from app.ml.inventory_prediction.trainer import train_inventory_prediction

            await train_inventory_prediction(db, restaurant_id)
            rates = get_model(restaurant_id)
        if rates is None:
            return None

    today = date.today()

    results = []
    for item_id, info in rates.items():
        if item_ids and item_id not in item_ids:
            continue

        daily_rate = info["dailyRate"]
        current_stock = info["currentStock"]

        if daily_rate <= 0:
            depletion_date = None
            days_remaining = None
        else:
            days_remaining = current_stock / daily_rate
            depletion_date = today + timedelta(days=int(days_remaining))

        # Reorder when stock drops below 7 days of consumption
        reorder_threshold = daily_rate * 7
        reorder_quantity = max(0, round(daily_rate * 14 - current_stock, 2))

        results.append({
            "itemId": item_id,
            "name": info["name"],
            "unit": info["unit"],
            "currentStock": round(current_stock, 2),
            "dailyRate": daily_rate,
            "depletionDate": depletion_date.isoformat() if depletion_date else None,
            "daysRemaining": round(days_remaining, 1) if days_remaining is not None else None,
            "reorderDate": (depletion_date - timedelta(days=3)).isoformat() if depletion_date else None,
            "reorderQuantity": reorder_quantity,
            "needsReorder": current_stock <= reorder_threshold,
        })

    # Sort by urgency (daysRemaining ascending)
    results.sort(key=lambda x: x["daysRemaining"] if x["daysRemaining"] is not None else float("inf"))

    return results