"""Opportunity Detector — identifies growth and optimization opportunities.

Detects:
    - Upsell opportunities (popular items, combos)
    - High-value customers for targeted promotions
    - Peak periods for staff optimization
    - Underperforming items to replace
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class OpportunityResult:
    """A single detected opportunity."""

    type: str  # upsell, peak_period, high_value_customer, menu_optimization
    severity: str  # low, medium, high
    category: str
    detail: str
    recommendation: str
    potential_value: str = ""
    detected_at: str = ""


@dataclass
class OpportunityDetection:
    """Aggregated opportunity detection results."""

    opportunities: list[OpportunityResult] = field(default_factory=list)
    total_detected: int = 0


class OpportunityDetector:
    """Detects business growth opportunities from operational data."""

    async def detect_upsell_opportunities(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[OpportunityResult]:
        """Find frequently bought together items for upsell recommendations."""
        from app.services.top_items_service import get_frequently_bought_together

        results: list[OpportunityResult] = []
        try:
            pairs = await get_frequently_bought_together(db, restaurant_id, limit=5)
            for pair in pairs[:3]:
                item_a = pair.get("itemA", "Unknown")
                item_b = pair.get("itemB", "Unknown")
                freq = pair.get("frequency", 0)

                if freq >= 3:
                    results.append(OpportunityResult(
                        type="upsell",
                        severity="medium",
                        category="menu_optimization",
                        detail=f"Customers who order {item_a} also buy {item_b} ({freq} times)",
                        recommendation=f"Suggest {item_b} as an add-on when {item_a} is ordered. Consider a combo deal.",
                        potential_value=f"~{freq} additional orders",
                        detected_at=datetime.now().isoformat(),
                    ))
        except Exception:
            logger.exception("Upsell opportunity detection failed")

        return results

    async def detect_peak_periods(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[OpportunityResult]:
        """Identify peak hours for staffing and marketing opportunities."""
        from app.repositories.revenue_repository import fetch_peak_hours

        results: list[OpportunityResult] = []
        try:
            peak_data = await fetch_peak_hours(db, restaurant_id)
            if peak_data:
                peak_hour = peak_data.get("peak_hour", 0)
                peak_count = peak_data.get("max_orders", 0)

                if peak_count > 0:
                    results.append(OpportunityResult(
                        type="peak_period",
                        severity="medium",
                        category="operations",
                        detail=f"Peak hour is {peak_hour}:00 with {peak_count} orders",
                        recommendation=f"Ensure adequate staffing during {peak_hour - 1}:00–{peak_hour + 1}:00. Consider running promotions during off-peak hours (2–5 PM).",
                        detected_at=datetime.now().isoformat(),
                    ))
        except Exception:
            logger.exception("Peak period detection failed")

        return results

    async def detect_high_value_customers(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[OpportunityResult]:
        """Identify high-value customers for loyalty programs."""
        from sqlalchemy import desc, func, select

        from app.models import Customer, Order, LoyaltyAccount

        results: list[OpportunityResult] = []
        try:
            stmt = (
                select(
                    Customer.id,
                    Customer.name,
                    Customer.phone,
                    func.count(Order.id).label("order_count"),
                    func.coalesce(func.sum(Order.total_amount), 0).label("total_spent"),
                )
                .join(Order, Order.customer_id == Customer.id)
                .where(Order.restaurant_id == restaurant_id)
                .where(Order.status == "COMPLETED")
                .group_by(Customer.id)
                .order_by(desc("total_spent"))
                .limit(5)
            )
            result = await db.execute(stmt)
            top_customers = result.all()

            if top_customers:
                names = [c.name or c.phone or "Customer" for c in top_customers[:3]]
                results.append(OpportunityResult(
                    type="high_value_customer",
                    severity="low",
                    category="customers",
                    detail=f"Top customers: {', '.join(names)}",
                    recommendation="Offer loyalty rewards or exclusive previews to these customers to increase retention.",
                    detected_at=datetime.now().isoformat(),
                ))
        except Exception:
            logger.exception("High-value customer detection failed")

        return results

    async def detect_menu_optimization(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[OpportunityResult]:
        """Identify top and bottom performers for menu optimization."""
        from app.services.top_items_service import get_top_items

        results: list[OpportunityResult] = []
        try:
            top_items = await get_top_items(db, restaurant_id, limit=5)
            if len(top_items) >= 2:
                top = top_items[0]
                second = top_items[1]
                top_name = top.get("itemName", "Unknown")
                top_revenue = top.get("revenue", 0)

                if top_revenue > 0:
                    results.append(OpportunityResult(
                        type="menu_optimization",
                        severity="medium",
                        category="menu",
                        detail=f"Top seller: {top_name} (₹{top_revenue:,.0f})",
                        recommendation=f"Feature {top_name} prominently on the menu. Create a combo with {second.get('itemName', 'Unknown')} to boost the second item.",
                        detected_at=datetime.now().isoformat(),
                    ))
        except Exception:
            logger.exception("Menu optimization detection failed")

        return results

    async def detect_all(self, db: "AsyncSession", restaurant_id: str) -> OpportunityDetection:
        """Run all opportunity detectors."""
        all_opps: list[OpportunityResult] = []

        detectors = [
            self.detect_upsell_opportunities,
            self.detect_peak_periods,
            self.detect_high_value_customers,
            self.detect_menu_optimization,
        ]

        for detector in detectors:
            try:
                results = await detector(db, restaurant_id)
                all_opps.extend(results)
            except Exception:
                logger.exception("Opportunity detector %s failed", detector.__name__)

        return OpportunityDetection(
            opportunities=all_opps,
            total_detected=len(all_opps),
        )


async def detect_opportunities(db: "AsyncSession", restaurant_id: str) -> OpportunityDetection:
    """Convenience function to detect all opportunities."""
    detector = OpportunityDetector()
    return await detector.detect_all(db, restaurant_id)