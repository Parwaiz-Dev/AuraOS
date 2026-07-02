"""Cron job definitions for scheduled model training and RAG maintenance.

Schedule:
    Revenue Forecast:       Daily at 2:00 AM
    Order Forecast:         Daily at 2:15 AM
    Customer Segmentation:  Daily at 2:30 AM
    Recommendation Engine:  Daily at 2:45 AM
    Wait Time Prediction:   Hourly (at :00)
    Inventory Prediction:   Daily at 3:00 AM
    Daily Insights:         Daily at 8:00 AM
    Weekly Reports:         Every Monday at 9:00 AM
    Embedding Refresh:      Daily at 4:00 AM
    Stale Document Cleanup: Daily at 4:30 AM
"""

from __future__ import annotations

import asyncio
import logging

from app.config.database import _async_session_factory
from app.models import Restaurant

logger = logging.getLogger(__name__)


async def _publish_model_retrained(model_name: str, restaurant_id: str) -> None:
    """Publish a ModelRetrained event (best-effort)."""
    try:
        from app.events.domain_events import ModelRetrained
        from app.events.publisher import publish

        await publish(ModelRetrained(
            model_name=model_name,
            restaurant_id=str(restaurant_id),
        ))
    except Exception:
        logger.debug("Failed to publish ModelRetrained event", exc_info=True)


async def _discover_restaurants() -> list[str]:
    """Query the database for all restaurant IDs that have data."""
    try:
        async with _async_session_factory() as session:
            from sqlalchemy import select

            stmt = select(Restaurant.id)
            result = await session.execute(stmt)
            ids = [row[0] for row in result.fetchall()]
            logger.info("Discovered %d restaurants for training", len(ids))
            return ids
    except Exception:
        logger.exception("Failed to discover restaurants")
        return []


async def _train_revenue_forecast(restaurants: list[str]) -> None:
    """Run revenue forecast training for all restaurants sequentially."""
    from app.tasks.revenue_training_task import run_revenue_training

    logger.info("Starting scheduled revenue forecast training for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            await run_revenue_training(rid)
            await _publish_model_retrained("revenue_forecast", rid)
        except Exception:
            logger.exception("Revenue training failed for restaurant=%s", rid)


async def _train_order_forecast(restaurants: list[str]) -> None:
    """Run order forecast training for all restaurants sequentially."""
    from app.tasks.order_training_task import run_order_training

    logger.info("Starting scheduled order forecast training for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            await run_order_training(rid)
            await _publish_model_retrained("order_forecast", rid)
        except Exception:
            logger.exception("Order training failed for restaurant=%s", rid)


async def _train_customer_segmentation(restaurants: list[str]) -> None:
    """Run customer segmentation training for all restaurants sequentially."""
    from app.tasks.segmentation_training_task import run_segmentation_training

    logger.info("Starting scheduled customer segmentation training for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            await run_segmentation_training(rid)
            await _publish_model_retrained("customer_segmentation", rid)
        except Exception:
            logger.exception("Segmentation training failed for restaurant=%s", rid)


async def _train_recommendation_engine(restaurants: list[str]) -> None:
    """Run recommendation engine training for all restaurants sequentially."""
    from app.tasks.recommendation_training_task import run_recommendation_training

    logger.info("Starting scheduled recommendation training for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            await run_recommendation_training(rid)
            await _publish_model_retrained("recommendation_engine", rid)
        except Exception:
            logger.exception("Recommendation training failed for restaurant=%s", rid)


async def _train_wait_time_prediction(restaurants: list[str]) -> None:
    """Run wait time prediction training for all restaurants sequentially."""
    from app.tasks.wait_time_training_task import run_wait_time_training

    logger.info("Starting scheduled wait time training for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            await run_wait_time_training(rid)
            await _publish_model_retrained("wait_time_prediction", rid)
        except Exception:
            logger.exception("Wait time training failed for restaurant=%s", rid)


async def _train_inventory_prediction(restaurants: list[str]) -> None:
    """Run inventory prediction training for all restaurants sequentially."""
    from app.tasks.inventory_training_task import run_inventory_training

    logger.info("Starting scheduled inventory prediction training for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            await run_inventory_training(rid)
            await _publish_model_retrained("inventory_prediction", rid)
        except Exception:
            logger.exception("Inventory training failed for restaurant=%s", rid)


async def _generate_daily_insights(restaurants: list[str]) -> None:
    """Generate daily AI insights for all restaurants."""
    from app.insights.insight_generator import generate_daily_insights

    logger.info("Starting daily insight generation for %d restaurants", len(restaurants))
    async with _async_session_factory() as session:
        for rid in restaurants:
            try:
                await generate_daily_insights(session, rid)
                logger.info("Daily insights generated for restaurant=%s", rid)
                try:
                    from app.events.domain_events import InsightGenerated
                    from app.events.publisher import publish

                    await publish(InsightGenerated(restaurant_id=str(rid)))
                except Exception:
                    pass
            except Exception:
                logger.exception("Daily insight generation failed for restaurant=%s", rid)


async def _generate_weekly_reports(restaurants: list[str]) -> None:
    """Generate weekly AI reports for all restaurants."""
    from app.insights.insight_generator import generate_weekly_report

    logger.info("Starting weekly report generation for %d restaurants", len(restaurants))
    async with _async_session_factory() as session:
        for rid in restaurants:
            try:
                await generate_weekly_report(session, rid)
                logger.info("Weekly report generated for restaurant=%s", rid)
            except Exception:
                logger.exception("Weekly report generation failed for restaurant=%s", rid)


async def _refresh_embeddings(restaurants: list[str]) -> None:
    """Refresh embeddings for all documents (daily maintenance)."""
    logger.info("Starting embedding refresh for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            from app.rag.knowledge_base import get_knowledge_base

            kb = get_knowledge_base()
            docs = kb.list_documents(rid)
            if docs:
                logger.info("Refreshing %d document embeddings for restaurant=%s", len(docs), rid)
        except Exception:
            logger.exception("Embedding refresh failed for restaurant=%s", rid)


async def _cleanup_stale_documents(restaurants: list[str]) -> None:
    """Remove stale documents and orphaned chunks."""
    logger.info("Starting stale document cleanup for %d restaurants", len(restaurants))
    for rid in restaurants:
        try:
            from app.rag.knowledge_base import get_knowledge_base
            from app.rag.vector_store import get_vector_store

            kb = get_knowledge_base()
            store = get_vector_store()

            doc_count = kb.count(rid)
            chunk_count = await store.count(rid)
            logger.info(
                "RAG cleanup: restaurant=%s documents=%d chunks=%d",
                rid,
                doc_count,
                chunk_count,
            )
        except Exception:
            logger.exception("Stale document cleanup failed for restaurant=%s", rid)


# ── Job definitions ──────────────────────────────────────────────────────────────

ALL_JOBS = [
    {
        "id": "revenue_forecast_training",
        "name": "Revenue Forecast Training",
        "cron": "0 2 * * *",  # Daily at 2:00 AM
        "func": _train_revenue_forecast,
    },
    {
        "id": "order_forecast_training",
        "name": "Order Forecast Training",
        "cron": "15 2 * * *",  # Daily at 2:15 AM
        "func": _train_order_forecast,
    },
    {
        "id": "customer_segmentation_training",
        "name": "Customer Segmentation Training",
        "cron": "30 2 * * *",  # Daily at 2:30 AM
        "func": _train_customer_segmentation,
    },
    {
        "id": "recommendation_engine_training",
        "name": "Recommendation Engine Training",
        "cron": "45 2 * * *",  # Daily at 2:45 AM
        "func": _train_recommendation_engine,
    },
    {
        "id": "wait_time_prediction_training",
        "name": "Wait Time Prediction Training",
        "cron": "0 * * * *",  # Hourly at :00
        "func": _train_wait_time_prediction,
    },
    {
        "id": "inventory_prediction_training",
        "name": "Inventory Prediction Training",
        "cron": "0 3 * * *",  # Daily at 3:00 AM
        "func": _train_inventory_prediction,
    },
    {
        "id": "daily_insight_generation",
        "name": "Daily Insight Generation",
        "cron": "0 8 * * *",  # Daily at 8:00 AM
        "func": _generate_daily_insights,
    },
    {
        "id": "weekly_report_generation",
        "name": "Weekly Report Generation",
        "cron": "0 9 * * 1",  # Every Monday at 9:00 AM
        "func": _generate_weekly_reports,
    },
    {
        "id": "rag_embedding_refresh",
        "name": "RAG Embedding Refresh",
        "cron": "0 4 * * *",  # Daily at 4:00 AM
        "func": _refresh_embeddings,
    },
    {
        "id": "rag_stale_cleanup",
        "name": "RAG Stale Document Cleanup",
        "cron": "30 4 * * *",  # Daily at 4:30 AM
        "func": _cleanup_stale_documents,
    },
]