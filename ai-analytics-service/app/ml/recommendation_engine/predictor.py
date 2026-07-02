"""Predictor for Recommendation Engine — returns recommendations for given items."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.ml.recommendation_engine.model_manager import get_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def predict_recommendations(
    restaurant_id: str,
    *,
    item_ids: list[str] | None = None,
    limit: int = 10,
    db: "AsyncSession | None" = None,
) -> list[dict] | None:
    """
    Return recommended items based on association rules.

    If *item_ids* is provided, returns "People who buy X also buy Y".
    If *item_ids* is None, returns the top overall recommendations.
    """
    rules = get_model(restaurant_id)
    if rules is None:
        logger.info("No cached recommendation rules for %s; attempting auto-train", restaurant_id)
        if db is not None:
            from app.ml.recommendation_engine.trainer import train_recommendations

            await train_recommendations(db, restaurant_id)
            rules = get_model(restaurant_id)
        if rules is None:
            return None

    from app.repositories.recommendation_repository import fetch_item_names

    if db is None:
        return None

    if item_ids:
        # Collect recommendations for the given items
        candidates: dict[str, dict] = {}
        for item_id in item_ids:
            for rec in rules.get(str(item_id), []):
                rid = rec["itemId"]
                if rid in item_ids:
                    continue  # don't recommend an item already in the list
                if rid not in candidates or rec["confidence"] > candidates[rid]["confidence"]:
                    candidates[rid] = rec

        sorted_recs = sorted(candidates.values(), key=lambda x: x["confidence"], reverse=True)[:limit]
    else:
        # Global top recommendations — aggregate all rules
        aggregated: dict[str, dict] = {}
        for item_id, recs in rules.items():
            for rec in recs:
                rid = rec["itemId"]
                if rid not in aggregated or rec["confidence"] > aggregated[rid]["confidence"]:
                    aggregated[rid] = rec
        sorted_recs = sorted(aggregated.values(), key=lambda x: x["confidence"], reverse=True)[:limit]

    if not sorted_recs:
        return []

    # Enrich with item names
    rec_ids = [r["itemId"] for r in sorted_recs]
    name_map = await fetch_item_names(db, rec_ids)

    return [
        {
            "itemId": r["itemId"],
            "itemName": name_map.get(r["itemId"], "Unknown Item"),
            "confidence": r["confidence"],
            "support": r["support"],
        }
        for r in sorted_recs
    ]