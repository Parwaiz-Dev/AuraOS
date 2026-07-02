"""Mock LLM provider for the AI Copilot — used in testing and offline development."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.providers import LLMProvider

if TYPE_CHECKING:
    from app.copilot.conversation_memory import ConversationMemory

logger = logging.getLogger(__name__)


class MockProvider(LLMProvider):
    """Returns deterministic, context-aware responses based on the prompt content.

    This provider is used during development and testing when no API key is
    configured.  It inspects the prompt for key phrases to return plausible
    mock answers.
    """

    @property
    def name(self) -> str:
        return "mock"

    async def generate(self, prompt: str, *, memory: "ConversationMemory | None" = None) -> str:
        """Generate a mock response based on prompt content analysis."""
        _ = memory
        prompt_lower = prompt.lower()

        # Revenue questions
        if any(phrase in prompt_lower for phrase in ["revenue", "sales", "earning", "income"]):
            return (
                "Revenue this week is approximately ₹45,000, which is 8% lower than last week. "
                "The decline is primarily driven by lower weekday lunch orders (down 12%). "
                "Friday remains your strongest day with ₹12,500 in sales. "
                "Recommendation: Consider promoting combo meals during Tuesday–Thursday to boost mid-week revenue."
            )

        # Customer questions
        if any(phrase in prompt_lower for phrase in ["customer", "vip", "churn", "loyal"]):
            return (
                "You have 12 VIP customers who have spent over ₹10,000 each. "
                "3 customers (Rahul S., Priya M., Amit K.) show churn risk as they haven't ordered in 14+ days. "
                "Recommendation: Send a personalized 'We miss you' offer with 15% off to these at-risk customers."
            )

        # Menu / item questions
        if any(phrase in prompt_lower for phrase in ["menu", "item", "promote", "category", "best sell", "top sell"]):
            return (
                "Your top-selling item is Butter Chicken with 24 orders generating ₹7,200 in revenue. "
                "The 'Main Course' category performs best, contributing 45% of total revenue. "
                "Recommendation: Promote Naan and Butter Chicken as a combo — they are frequently bought together (120 co-occurrences)."
            )

        # Forecast questions
        if any(phrase in prompt_lower for phrase in ["forecast", "predict", "next week", "next month", "future"]):
            return (
                "Based on historical trends, next week's revenue is forecast at approximately ₹52,000. "
                "This represents a 15% increase from last week, driven by the upcoming weekend. "
                "Confidence in this forecast is 91%. The trend is upward."
            )

        # Inventory questions
        if any(phrase in prompt_lower for phrase in ["inventory", "stock", "restock", "waste"]):
            return (
                "3 items need immediate restocking: Flour (3 days remaining), Chicken (2 days), and Rice (4 days). "
                "Flour is at critical levels — current stock of 25 kg will deplete by June 21. "
                "Recommendation: Place orders for all 3 items today to avoid stockout."
            )

        # Wait time / operations questions
        if any(phrase in prompt_lower for phrase in ["wait", "peak hour", "kitchen", "busy", "table"]):
            return (
                "Current estimated wait time is 15 minutes. Kitchen load is medium (16 active items). "
                "Your peak hour is 7 PM (19:00) with an average of 8 orders per hour. "
                "Table occupancy is at 65%. Recommendation: Consider adding one more kitchen staff during 7-9 PM peak."
            )

        # Recommendation questions
        if any(phrase in prompt_lower for phrase in ["recommend", "suggest", "commonly bought", "frequently bought"]):
            return (
                "The most commonly bought-together pair is Burger + French Fries (120 co-occurrences). "
                "Other strong pairs: Naan + Butter Chicken (95), Coke + Pizza (78). "
                "Recommendation: Create a 'Burger Combo' with Fries and a drink at a 10% discount to boost average order value."
            )

        # General fallback
        return (
            "I can help you with questions about revenue, customers, menu items, forecasts, "
            "inventory, wait times, and recommendations. What would you like to know about your restaurant?"
        )

    async def health_check(self) -> bool:
        """Mock provider is always healthy."""
        return True