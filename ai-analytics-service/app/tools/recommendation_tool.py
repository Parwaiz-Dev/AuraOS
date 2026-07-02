"""Recommendation tool — wraps the recommendation service + frequently-bought-together."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def recommendation_tool(db: "AsyncSession", restaurant_id: str) -> dict[str, Any]:
    """Gather item recommendations and frequently-bought-together pairs."""
    from app.services.recommendation_service import get_recommendations
    from app.services.top_items_service import get_frequently_bought_together

    try:
        recs = await get_recommendations(db, restaurant_id, limit=5) or []
    except Exception:
        logger.debug("recommendation_tool: recommendations failed", exc_info=True)
        recs = []

    try:
        pairs = await get_frequently_bought_together(db, restaurant_id, limit=5) or []
    except Exception:
        logger.debug("recommendation_tool: pairs failed", exc_info=True)
        pairs = []

    return {
        "recommendations": [
            {
                "item_name": r.get("itemName"),
                "confidence": r.get("confidence"),
                "support": r.get("support"),
            }
            for r in recs[:5]
        ],
        "frequently_bought_together": [
            {
                "item_a": p.get("item_a"),
                "item_b": p.get("item_b"),
                "frequency": p.get("co_occurrence_count"),
            }
            for p in pairs[:5]
        ],
    }
