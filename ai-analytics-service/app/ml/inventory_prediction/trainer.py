"""Trainer for Inventory Prediction — computes daily consumption rates from history."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import numpy as np

from app.ml.inventory_prediction.model_manager import save_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
_MIN_DAYS = 14


async def train_inventory_prediction(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    lookback_days: int = 90,
) -> dict | None:
    """
    Compute daily consumption rates for each inventory item based on
    inventory transaction history.
    """
    from app.repositories.inventory_repository import fetch_inventory_transactions

    rows = await fetch_inventory_transactions(
        db, restaurant_id,
        start_date=date.today() - timedelta(days=lookback_days),
        end_date=date.today(),
    )

    if not rows:
        logger.warning("No inventory transaction data for restaurant=%s", restaurant_id)
        return None

    # Aggregate by item: total consumed / days with data
    from collections import defaultdict

    item_consumption: dict[str, list[float]] = defaultdict(list)
    item_meta: dict[str, dict] = {}

    for row in rows:
        item_id = str(row["item_id"])
        qty = float(row.get("quantity_change", 0))
        if qty < 0:
            # negative = consumption
            item_consumption[item_id].append(abs(qty))
        item_meta[item_id] = {
            "name": row.get("item_name", "Unknown"),
            "unit": row.get("unit", "units"),
            "currentStock": float(row.get("current_stock", 0)),
        }

    if not item_consumption:
        return None

    rates: dict[str, dict] = {}
    for item_id, daily_consumptions in item_consumption.items():
        if len(daily_consumptions) < _MIN_DAYS:
            continue
        daily_rate = round(float(np.mean(daily_consumptions)), 2)
        rates[item_id] = {
            "dailyRate": daily_rate,
            "name": item_meta[item_id]["name"],
            "unit": item_meta[item_id]["unit"],
            "currentStock": item_meta[item_id]["currentStock"],
        }

    if not rates:
        return None

    save_model(restaurant_id, rates)
    logger.info(
        "Inventory prediction model trained (restaurant=%s, items=%d)",
        restaurant_id, len(rates),
    )
    return rates