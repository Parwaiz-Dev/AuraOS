"""Risk Detector — predicts business risks before they materialize.

Detects:
    - Customer churn risk (inactive customers, low ratings)
    - Inventory stockout risk (low stock, high consumption)
    - Revenue decline risk (sustained downward trend)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class RiskResult:
    """A single detected risk."""

    type: str  # churn_risk, stockout_risk, revenue_decline_risk
    severity: str  # low, medium, high, critical
    category: str
    detail: str
    recommendation: str
    probability: float = 0.0  # 0.0–1.0 estimated probability
    detected_at: str = ""


@dataclass
class RiskDetection:
    """Aggregated risk detection results."""

    risks: list[RiskResult] = field(default_factory=list)
    total_detected: int = 0


class RiskDetector:
    """Detects business risks from operational data."""

    async def detect_churn_risk(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[RiskResult]:
        """Identify customers at risk of churning.

        Criteria:
            - No orders in the last 30 days
            - Low average rating (if they left reviews)
        """
        from sqlalchemy import desc, func, select

        from app.models import Customer, Order, Review

        results: list[RiskResult] = []
        try:
            cutoff = datetime.utcnow() - timedelta(days=30)

            # Find customers whose last order was >30 days ago
            last_order_subq = (
                select(
                    Order.customer_id,
                    func.max(Order.created_at).label("last_order_date"),
                    func.count(Order.id).label("total_orders"),
                    func.coalesce(func.sum(Order.total_amount), 0).label("total_spent"),
                )
                .where(Order.restaurant_id == restaurant_id)
                .where(Order.customer_id.isnot(None))
                .group_by(Order.customer_id)
                .subquery()
            )

            stmt = (
                select(
                    Customer.id,
                    Customer.name,
                    Customer.phone,
                    last_order_subq.c.last_order_date,
                    last_order_subq.c.total_orders,
                    last_order_subq.c.total_spent,
                )
                .join(last_order_subq, Customer.id == last_order_subq.c.customer_id)
                .where(last_order_subq.c.last_order_date < cutoff)
                .order_by(last_order_subq.c.last_order_date)
                .limit(5)
            )
            result = await db.execute(stmt)
            at_risk = result.all()

            for row in at_risk:
                name = row.name or row.phone or "Customer"
                days_inactive = (datetime.utcnow() - row.last_order_date).days
                probability = min(0.8, 0.3 + (days_inactive - 30) * 0.01)

                severity = (
                    "high" if days_inactive > 90
                    else "medium" if days_inactive > 60
                    else "low"
                )

                results.append(RiskResult(
                    type="churn_risk",
                    severity=severity,
                    category="customers",
                    detail=f"{name} hasn't ordered in {days_inactive} days (total orders: {row.total_orders}, total spent: ₹{float(row.total_spent):,.0f})",
                    recommendation=f"Send a re-engagement offer to {name} — e.g., 10% off next order or free delivery.",
                    probability=round(probability, 2),
                    detected_at=datetime.now().isoformat(),
                ))

            # Also check for low-rated customers
            review_stmt = (
                select(
                    Customer.id,
                    Customer.name,
                    Customer.phone,
                    func.avg(Review.rating).label("avg_rating"),
                    func.count(Review.id).label("review_count"),
                )
                .join(Review, Review.customer_id == Customer.id)
                .where(Review.restaurant_id == restaurant_id)
                .group_by(Customer.id)
                .having(func.avg(Review.rating) <= 2.5)
                .limit(3)
            )
            review_result = await db.execute(review_stmt)
            low_rated = review_result.all()

            for row in low_rated:
                name = row.name or row.phone or "Customer"
                avg = round(float(row.avg_rating), 1)
                results.append(RiskResult(
                    type="churn_risk",
                    severity="medium",
                    category="customers",
                    detail=f"{name} gave an average rating of {avg}/5 across {row.review_count} review(s)",
                    recommendation=f"Reach out to {name} to understand their experience and offer a complimentary item on their next visit.",
                    probability=0.6,
                    detected_at=datetime.now().isoformat(),
                ))

        except Exception:
            logger.exception("Churn risk detection failed")

        return results

    async def detect_stockout_risk(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[RiskResult]:
        """Identify inventory items at risk of stockout.

        Uses current stock levels and consumption rate from transaction history.
        """
        from sqlalchemy import func, select

        from app.models import InventoryItem, InventoryTransaction, MenuItem

        results: list[RiskResult] = []
        try:
            # Get items with low stock
            stmt = (
                select(InventoryItem, MenuItem.name)
                .join(MenuItem, InventoryItem.menu_item_id == MenuItem.id)
                .where(InventoryItem.restaurant_id == restaurant_id)
                .where(InventoryItem.current_stock <= InventoryItem.reorder_level * 2)
            )
            result = await db.execute(stmt)
            items = result.all()

            for inv_item, item_name in items:
                # Calculate daily consumption rate from recent transactions
                tx_stmt = (
                    select(
                        func.coalesce(func.sum(InventoryTransaction.quantity_change), 0),
                    )
                    .where(InventoryTransaction.menu_item_id == inv_item.menu_item_id)
                    .where(InventoryTransaction.transaction_type == "USAGE")
                    .where(InventoryTransaction.created_at >= datetime.utcnow() - timedelta(days=14))
                )
                tx_result = await db.execute(tx_stmt)
                total_used = abs(tx_result.scalar() or 0)
                daily_rate = total_used / 14.0 if total_used > 0 else 0.0

                stock = inv_item.current_stock
                reorder = inv_item.reorder_level

                if stock == 0:
                    severity = "critical"
                    days_left = 0
                    probability = 1.0
                elif daily_rate > 0:
                    days_left = stock / daily_rate
                    probability = min(1.0, 1.0 - (stock / max(reorder * 2, 1)))
                    severity = (
                        "critical" if days_left <= 1
                        else "high" if days_left <= 3
                        else "medium" if days_left <= 7
                        else "low"
                    )
                else:
                    severity = "low" if stock <= reorder else "medium"
                    days_left = float("inf")
                    probability = 0.3 if stock <= reorder else 0.1

                if severity == "low" and stock > reorder:
                    continue  # Not a meaningful risk

                days_str = f"{days_left:.1f} days" if days_left != float("inf") else "unknown"
                results.append(RiskResult(
                    type="stockout_risk",
                    severity=severity,
                    category="inventory",
                    detail=f"{item_name}: {stock} in stock (reorder at {reorder}), estimated {days_str} remaining",
                    recommendation=f"Reorder {item_name} immediately to avoid stockout. Current daily usage: {daily_rate:.1f} units/day.",
                    probability=round(probability, 2),
                    detected_at=datetime.now().isoformat(),
                ))

        except Exception:
            logger.exception("Stockout risk detection failed")

        return results

    async def detect_revenue_decline_risk(
        self,
        db: "AsyncSession",
        restaurant_id: str,
    ) -> list[RiskResult]:
        """Detect sustained revenue decline that may indicate a broader problem.

        Uses weekly revenue data to check for 2+ consecutive weeks of decline.
        """
        from app.repositories.revenue_repository import (
            fetch_daily_revenue,
            fetch_weekly_revenue,
        )

        results: list[RiskResult] = []
        try:
            weekly = await fetch_weekly_revenue(db, restaurant_id, limit=5)
            if len(weekly) < 3:
                return results

            revenues = [float(w.get("revenue", 0)) for w in weekly]
            declines = 0
            for i in range(len(revenues) - 1):
                if revenues[i] < revenues[i + 1]:
                    # Current week is lower than previous week
                    declines += 1

            if declines >= 2:
                # Sustained decline — compute overall trend
                latest = revenues[0]
                earliest = revenues[-1] if revenues[-1] > 0 else 1.0
                total_change = ((latest - earliest) / earliest) * 100

                if total_change < -10:
                    severity = "high"
                    probability = 0.7
                elif total_change < -5:
                    severity = "medium"
                    probability = 0.5
                else:
                    severity = "low"
                    probability = 0.3

                # Check daily revenue for recent trend
                daily = await fetch_daily_revenue(db, restaurant_id, limit=7)
                if daily:
                    daily_revs = [float(d.get("revenue", 0)) for d in daily]
                    daily_avg = float(np.mean(daily_revs))
                    daily_std = float(np.std(daily_revs))
                    cv = daily_std / daily_avg if daily_avg > 0 else 0.0

                    volatility_note = ""
                    if cv > 0.3:
                        volatility_note = " Revenue is highly volatile, which may mask underlying issues."
                        probability = min(1.0, probability + 0.1)

                    results.append(RiskResult(
                        type="revenue_decline_risk",
                        severity=severity,
                        category="revenue",
                        detail=f"Revenue declined for {declines} consecutive weeks (total drop: {total_change:.1f}%).{volatility_note}",
                        recommendation="Review recent menu changes, customer feedback, and competitor activity. Consider running a promotion or revisiting pricing strategy.",
                        probability=round(probability, 2),
                        detected_at=datetime.now().isoformat(),
                    ))

        except Exception:
            logger.exception("Revenue decline risk detection failed")

        return results

    async def detect_all(self, db: "AsyncSession", restaurant_id: str) -> RiskDetection:
        """Run all risk detectors and return aggregated results."""
        all_risks: list[RiskResult] = []

        detectors = [
            self.detect_churn_risk,
            self.detect_stockout_risk,
            self.detect_revenue_decline_risk,
        ]

        for detector in detectors:
            try:
                results = await detector(db, restaurant_id)
                all_risks.extend(results)
            except Exception:
                logger.exception("Risk detector %s failed", detector.__name__)

        return RiskDetection(
            risks=all_risks,
            total_detected=len(all_risks),
        )


async def detect_risks(db: "AsyncSession", restaurant_id: str) -> RiskDetection:
    """Convenience function to detect all risks."""
    detector = RiskDetector()
    return await detector.detect_all(db, restaurant_id)