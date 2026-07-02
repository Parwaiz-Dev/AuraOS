"""Insight Service — orchestrates insight generation with DB session management.

Provides the service layer between the API router and the insight generators.
Also handles notification dispatch when insights are generated.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.insights.insight_generator import (
    InsightGenerator,
    get_insight_history,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_daily_insights(
    db: "AsyncSession",
    restaurant_id: str,
    restaurant_name: str = "Your restaurant",
) -> dict:
    """Generate daily insights for a restaurant.

    Args:
        db: Async database session.
        restaurant_id: Target restaurant UUID.
        restaurant_name: Display name for summaries.

    Returns:
        Serialized daily insight dict.
    """
    generator = InsightGenerator()
    insight = await generator.generate_daily_insights(
        db=db,
        restaurant_id=restaurant_id,
        restaurant_name=restaurant_name,
    )

    # Milestone 8: Publish InsightGenerated event
    try:
        from app.events.domain_events import InsightGenerated
        from app.events.publisher import publish

        await publish(InsightGenerated(
            restaurant_id=restaurant_id,
            anomaly_count=insight.anomaly_count,
            trend_count=insight.trend_count,
            opportunity_count=insight.opportunity_count,
            risk_count=insight.risk_count,
        ))
    except Exception:
        logger.debug("Failed to publish InsightGenerated event", exc_info=True)

    return insight.to_dict()


async def get_weekly_report(
    db: "AsyncSession",
    restaurant_id: str,
    restaurant_name: str = "Your restaurant",
) -> dict:
    """Generate a weekly AI report for a restaurant.

    Args:
        db: Async database session.
        restaurant_id: Target restaurant UUID.
        restaurant_name: Display name for summaries.

    Returns:
        Serialized weekly report dict.
    """
    generator = InsightGenerator()
    report = await generator.generate_weekly_report(
        db=db,
        restaurant_id=restaurant_id,
        restaurant_name=restaurant_name,
    )
    return report.to_dict()


async def get_history(
    restaurant_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Retrieve stored insight history.

    Args:
        restaurant_id: Optional filter by restaurant.
        limit: Maximum entries to return.

    Returns:
        List of insight history entries, newest first.
    """
    return await get_insight_history(restaurant_id=restaurant_id, limit=limit)