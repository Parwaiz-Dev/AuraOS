"""Context Builder — gathers data from analytics services to build compact context.

Collects data from all analytics services (revenue, dashboard, forecast,
segmentation, recommendations, wait_time, inventory) and builds a compact
JSON context object. Never sends raw database rows.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.copilot.intent_classifier import Intent, classify_intent

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def build_context(
    db: "AsyncSession",
    restaurant_id: str,
    message: str,
) -> dict:
    """Build a compact context dict for the LLM prompt.

    The context is tailored based on the detected intent to avoid
    unnecessary service calls and keep the prompt small.
    """
    intent = classify_intent(message)
    context: dict = {
        "intent": intent.value,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data": {},
    }

    try:
        # Always include dashboard KPIs for general awareness
        if intent in (Intent.REVENUE, Intent.GENERAL, Intent.FORECAST, Intent.OPERATIONS):
            await _add_revenue_context(db, restaurant_id, context)
            await _add_dashboard_context(db, restaurant_id, context)

        if intent in (Intent.FORECAST, Intent.GENERAL):
            await _add_forecast_context(db, restaurant_id, context)

        if intent in (Intent.CUSTOMERS, Intent.GENERAL):
            await _add_customer_context(db, restaurant_id, context)

        if intent in (Intent.RECOMMENDATIONS, Intent.GENERAL, Intent.MENU):
            await _add_recommendation_context(db, restaurant_id, context)

        if intent in (Intent.MENU, Intent.GENERAL):
            await _add_menu_context(db, restaurant_id, context)

        if intent in (Intent.OPERATIONS, Intent.GENERAL):
            await _add_operations_context(db, restaurant_id, context)

        if intent in (Intent.INVENTORY, Intent.GENERAL):
            await _add_inventory_context(db, restaurant_id, context)

    except Exception:
        logger.exception("Error building context for intent=%s", intent)

    return context


async def _add_revenue_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add revenue analytics data to context."""
    from app.services.revenue_service import (
        get_daily_revenue,
        get_weekly_revenue,
        get_peak_hours,
    )

    daily = await get_daily_revenue(db, restaurant_id, limit=7)  # type: ignore[arg-type]
    weekly = await get_weekly_revenue(db, restaurant_id, limit=4)  # type: ignore[arg-type]
    peak = await get_peak_hours(db, restaurant_id)  # type: ignore[arg-type]

    context["data"]["revenue"] = {
        "daily_recent_7d": [
            {
                "date": d["date"],
                "revenue": d["totalRevenue"],
                "orders": d["completedOrders"],
                "aov": d["averageOrderValue"],
                "growth": d.get("growthPercentage"),
            }
            for d in (daily or [])[:7]
        ],
        "weekly_recent_4w": [
            {
                "week_start": w["weekStart"],
                "revenue": w["totalRevenue"],
                "growth": w.get("growthPercentage"),
            }
            for w in (weekly or [])[:4]
        ],
        "peak_hours": [
            {"hour": p["hour"], "orders": p["orderCount"]}
            for p in (peak or [])[:6]
        ],
    }


async def _add_dashboard_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add dashboard KPIs to context."""
    from app.services.dashboard_service import get_dashboard

    dashboard = await get_dashboard(db, restaurant_id)  # type: ignore[arg-type]
    context["data"]["dashboard"] = {
        "total_revenue_today": dashboard.get("totalRevenue"),
        "total_orders_today": dashboard.get("totalOrders"),
        "completed_orders": dashboard.get("completedOrders"),
        "cancelled_orders": dashboard.get("cancelledOrders"),
        "average_order_value": dashboard.get("averageOrderValue"),
        "active_customers": dashboard.get("activeCustomers"),
        "repeat_customers": dashboard.get("repeatCustomers"),
        "peak_hour": dashboard.get("peakHour"),
        "top_selling_item": dashboard.get("topSellingItem"),
    }


async def _add_forecast_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add forecast data to context."""
    from app.services.revenue_forecast_service import get_revenue_forecast

    forecast = await get_revenue_forecast(db, restaurant_id, days=7)  # type: ignore[arg-type]
    if forecast and isinstance(forecast, dict):
        context["data"]["forecast"] = {
            "trend": forecast.get("trend"),
            "confidence": forecast.get("confidence"),
            "growth_percentage": forecast.get("growthPercentage"),
            "next_7_days": [
                {"date": f.get("date"), "revenue": f.get("revenue")}
                for f in (forecast.get("forecast") or [])[:7]
            ],
        }


async def _add_customer_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add customer segmentation data to context."""
    from app.services.customer_segmentation_service import get_customer_segments

    segments = await get_customer_segments(db, restaurant_id)  # type: ignore[arg-type]
    if segments:
        # Count segments
        segment_counts: dict[str, int] = {}
        vip_customers: list[dict] = []
        churn_risks: list[dict] = []
        for s in segments:
            seg = s.get("segment", "Unknown")
            segment_counts[seg] = segment_counts.get(seg, 0) + 1
            if seg == "VIP":
                vip_customers.append({
                    "name": s.get("name", "Unknown"),
                    "total_spent": s.get("totalSpent"),
                })
            if seg in ("At Risk", "Lost"):
                churn_risks.append({
                    "name": s.get("name", "Unknown"),
                    "segment": seg,
                    "days_since_last": s.get("recencyDays"),
                })
        context["data"]["customers"] = {
            "segment_counts": segment_counts,
            "vip_customers": vip_customers[:5],
            "churn_risks": churn_risks[:5],
            "total_customers": len(segments),
        }


async def _add_recommendation_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add recommendation data to context."""
    from app.services.recommendation_service import get_recommendations

    recs = await get_recommendations(db, restaurant_id, limit=5)  # type: ignore[arg-type]
    if recs:
        context["data"]["recommendations"] = [
            {
                "item_name": r.get("itemName"),
                "confidence": r.get("confidence"),
                "support": r.get("support"),
            }
            for r in recs[:5]
        ]


async def _add_menu_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add menu/top-items data to context."""
    from app.services.top_items_service import (
        get_top_items,
        get_top_categories,
        get_frequently_bought_together,
    )

    top_items = await get_top_items(db, restaurant_id, limit=5)  # type: ignore[arg-type]
    top_cats = await get_top_categories(db, restaurant_id, limit=5)  # type: ignore[arg-type]
    pairs = await get_frequently_bought_together(db, restaurant_id, limit=5)  # type: ignore[arg-type]

    context["data"]["menu"] = {
        "top_items": [
            {
                "name": i.get("name"),
                "category": i.get("category"),
                "total_sold": i.get("total_sold"),
                "total_revenue": i.get("total_revenue"),
            }
            for i in (top_items or [])[:5]
        ],
        "top_categories": [
            {
                "name": c.get("name"),
                "revenue": c.get("total_revenue"),
            }
            for c in (top_cats or [])[:5]
        ],
        "frequently_bought_together": [
            {
                "item_a": p.get("item_a"),
                "item_b": p.get("item_b"),
                "frequency": p.get("co_occurrence_count"),
            }
            for p in (pairs or [])[:5]
        ],
    }


async def _add_operations_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add operations/wait-time data to context."""
    from app.services.wait_time_service import get_wait_time

    wait_time = await get_wait_time(db, restaurant_id)  # type: ignore[arg-type]
    if wait_time and isinstance(wait_time, dict):
        context["data"]["operations"] = {
            "estimated_wait_minutes": wait_time.get("estimatedWaitMinutes"),
            "confidence": wait_time.get("confidence"),
            "kitchen_load": wait_time.get("factors", {}).get("kitchenLoad") if wait_time.get("factors") else None,
            "active_orders": wait_time.get("factors", {}).get("activeOrders") if wait_time.get("factors") else None,
            "table_occupancy": wait_time.get("factors", {}).get("tableOccupancy") if wait_time.get("factors") else None,
        }


async def _add_inventory_context(db: "AsyncSession", restaurant_id: str, context: dict) -> None:
    """Add inventory prediction data to context."""
    from app.services.inventory_service import get_inventory_predictions

    inventory = await get_inventory_predictions(db, restaurant_id)  # type: ignore[arg-type]
    if inventory:
        at_risk = [i for i in inventory if i.get("needsReorder")]
        context["data"]["inventory"] = {
            "total_items": len(inventory),
            "items_needing_reorder": len(at_risk),
            "at_risk_items": [
                {
                    "name": i.get("name"),
                    "current_stock": i.get("currentStock"),
                    "days_remaining": i.get("daysRemaining"),
                    "reorder_quantity": i.get("reorderQuantity"),
                }
                for i in at_risk[:5]
            ],
        }