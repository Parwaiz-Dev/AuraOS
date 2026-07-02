"""Trainer for Recommendation Engine — association rules via co-occurrence analysis."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import TYPE_CHECKING

from app.ml.recommendation_engine.model_manager import save_model

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
_MIN_ORDERS = 50
_MIN_SUPPORT = 0.02
_MIN_CONFIDENCE = 0.10


async def train_recommendations(
    db: "AsyncSession",
    restaurant_id: str,
    *,
    lookback_days: int = 90,
) -> dict | None:
    """
    Build association rules from order co-occurrence.

    For each item A, finds items B that frequently appear in the same order.
    """
    from app.repositories.recommendation_repository import fetch_order_item_pairs

    pairs = await fetch_order_item_pairs(
        db, restaurant_id,
        start_date=date.today() - timedelta(days=lookback_days),
        end_date=date.today(),
    )

    if not pairs:
        logger.warning("No order-item pairs for recommendations (restaurant=%s)", restaurant_id)
        return None

    # Count individual item occurrences and pair co-occurrences
    item_count: dict[str, int] = defaultdict(int)
    pair_count: dict[tuple[str, str], int] = defaultdict(int)
    total_orders = len(pairs)

    for row in pairs:
        item_a = str(row["item_a"])
        item_b = str(row["item_b"])
        item_count[item_a] += 1
        item_count[item_b] += 1
        pair_count[(item_a, item_b)] += 1

    if total_orders < _MIN_ORDERS:
        logger.warning("Insufficient orders for recommendation rules (n=%d)", total_orders)
        return None

    # Build rules: for each item, list recommended items with confidence
    rules: dict[str, list[dict]] = defaultdict(list)

    for (item_a, item_b), co_count in pair_count.items():
        support = co_count / total_orders
        if support < _MIN_SUPPORT:
            continue
        confidence_ab = co_count / item_count[item_a] if item_count[item_a] > 0 else 0
        confidence_ba = co_count / item_count[item_b] if item_count[item_b] > 0 else 0

        if confidence_ab >= _MIN_CONFIDENCE:
            rules[item_a].append({
                "itemId": item_b,
                "confidence": round(confidence_ab, 4),
                "support": round(support, 4),
            })
        if confidence_ba >= _MIN_CONFIDENCE:
            rules[item_b].append({
                "itemId": item_a,
                "confidence": round(confidence_ba, 4),
                "support": round(support, 4),
            })

    if not rules:
        return None

    # Sort each item's recommendations by confidence descending
    for item_id in rules:
        rules[item_id].sort(key=lambda x: x["confidence"], reverse=True)

    save_model(restaurant_id, dict(rules))
    logger.info(
        "Recommendation rules trained (restaurant=%s, items=%d, rules=%d)",
        restaurant_id, len(rules), sum(len(v) for v in rules.values()),
    )
    return dict(rules)