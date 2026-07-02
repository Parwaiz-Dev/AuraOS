"""Customer tool — wraps the customer segmentation service."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def customer_tool(db: "AsyncSession", restaurant_id: str) -> dict[str, Any]:
    """Gather customer segments, VIPs, and churn risks."""
    from app.services.customer_segmentation_service import get_customer_segments

    try:
        segments = await get_customer_segments(db, restaurant_id) or []
    except Exception:
        logger.debug("customer_tool: segments failed", exc_info=True)
        segments = []

    segment_counts: dict[str, int] = {}
    vip: list[dict] = []
    churn: list[dict] = []
    for s in segments:
        seg = s.get("segment", "Unknown")
        segment_counts[seg] = segment_counts.get(seg, 0) + 1
        if seg == "VIP":
            vip.append({"name": s.get("name", "Unknown"), "total_spent": s.get("totalSpent")})
        if seg in ("At Risk", "Lost"):
            churn.append(
                {
                    "name": s.get("name", "Unknown"),
                    "segment": seg,
                    "days_since_last": s.get("recencyDays"),
                }
            )

    return {
        "total_customers": len(segments),
        "segment_counts": segment_counts,
        "vip_customers": vip[:10],
        "churn_risks": churn[:10],
    }
