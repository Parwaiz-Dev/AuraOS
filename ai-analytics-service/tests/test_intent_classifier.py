"""Tests for Intent Classifier — Milestone 5."""

from __future__ import annotations

import pytest

from app.copilot.intent_classifier import Intent, classify_intent, classify_intents


class TestClassifyIntent:
    """Unit tests for classify_intent()."""

    # ── Revenue ──────────────────────────────────────────────────────────────

    def test_revenue_intent_revenue_keyword(self) -> None:
        assert classify_intent("What was my revenue this week?") == Intent.REVENUE

    def test_revenue_intent_sales_keyword(self) -> None:
        assert classify_intent("How are my sales looking?") == Intent.REVENUE

    def test_revenue_intent_compare_week(self) -> None:
        assert classify_intent("Compare this week to last week") == Intent.REVENUE

    def test_revenue_intent_why_revenue_down(self) -> None:
        assert classify_intent("Why is revenue down?") == Intent.REVENUE

    # ── Customers ────────────────────────────────────────────────────────────

    def test_customers_intent_vip(self) -> None:
        assert classify_intent("Who are my VIP customers?") == Intent.CUSTOMERS

    def test_customers_intent_churn(self) -> None:
        assert classify_intent("Show me churn risk") == Intent.CUSTOMERS

    def test_customers_intent_segment(self) -> None:
        assert classify_intent("What are my customer segments?") == Intent.CUSTOMERS

    def test_customers_intent_loyal(self) -> None:
        assert classify_intent("How loyal are my customers?") == Intent.CUSTOMERS

    # ── Forecast ─────────────────────────────────────────────────────────────

    def test_forecast_intent_forecast_keyword(self) -> None:
        assert classify_intent("Give me a revenue forecast") == Intent.FORECAST

    def test_forecast_intent_predict(self) -> None:
        assert classify_intent("Predict next week's sales") == Intent.FORECAST

    def test_forecast_intent_next_week(self) -> None:
        assert classify_intent("What will happen next week?") == Intent.FORECAST

    def test_forecast_intent_30_days(self) -> None:
        assert classify_intent("Forecast for the next 30 days") == Intent.FORECAST

    # ── Inventory ────────────────────────────────────────────────────────────

    def test_inventory_intent_stock(self) -> None:
        assert classify_intent("What is my stock level?") == Intent.INVENTORY

    def test_inventory_intent_restock(self) -> None:
        assert classify_intent("Which items need restocking?") == Intent.INVENTORY

    def test_inventory_intent_waste(self) -> None:
        assert classify_intent("How much waste do we have?") == Intent.INVENTORY

    def test_inventory_intent_need(self) -> None:
        assert classify_intent("Which items need to be reordered?") == Intent.INVENTORY

    # ── Operations ───────────────────────────────────────────────────────────

    def test_operations_intent_peak_hour(self) -> None:
        assert classify_intent("When is peak hour?") == Intent.OPERATIONS

    def test_operations_intent_wait_time(self) -> None:
        assert classify_intent("What is the wait time?") == Intent.OPERATIONS

    def test_operations_intent_kitchen(self) -> None:
        assert classify_intent("How is the kitchen doing?") == Intent.OPERATIONS

    def test_operations_intent_how_long(self) -> None:
        assert classify_intent("How long is the wait right now?") == Intent.OPERATIONS

    # ── Menu ─────────────────────────────────────────────────────────────────

    def test_menu_intent_best_performing(self) -> None:
        assert classify_intent("What are my best performing items?") == Intent.MENU

    def test_menu_intent_top_selling(self) -> None:
        assert classify_intent("Show me the top selling items") == Intent.MENU

    def test_menu_intent_category(self) -> None:
        assert classify_intent("Which category performs best?") == Intent.MENU

    def test_menu_intent_promote(self) -> None:
        assert classify_intent("What should I promote more?") == Intent.MENU

    # ── Recommendations ──────────────────────────────────────────────────────

    def test_recommendations_intent_recommend(self) -> None:
        assert classify_intent("What do you recommend?") == Intent.RECOMMENDATIONS

    def test_recommendations_intent_commonly_bought(self) -> None:
        assert classify_intent("What items are commonly bought together?") == Intent.RECOMMENDATIONS

    def test_recommendations_intent_suggest(self) -> None:
        assert classify_intent("Suggest some combos") == Intent.RECOMMENDATIONS

    # ── General ──────────────────────────────────────────────────────────────

    def test_general_intent_empty(self) -> None:
        assert classify_intent("Hello!") == Intent.GENERAL

    def test_general_intent_how_are_you(self) -> None:
        assert classify_intent("How are you doing today?") == Intent.GENERAL

    def test_general_intent_help(self) -> None:
        assert classify_intent("What can you help me with?") == Intent.GENERAL


class TestClassifyIntents:
    """Unit tests for classify_intents() — ranked multi-intent."""

    def test_returns_list_of_tuples(self) -> None:
        result = classify_intents("What was my revenue this week?")
        assert isinstance(result, list)
        assert len(result) > 0
        assert isinstance(result[0], tuple)
        assert isinstance(result[0][0], Intent)
        assert isinstance(result[0][1], int)

    def test_highest_scored_first(self) -> None:
        result = classify_intents("Why is revenue down and who are my VIP customers?")
        # CUSTOMERS: VIP(6) + customers(5) + who are my(3) = 14
        # REVENUE: why is revenue(6) + revenue(5) + down(1) = 12
        assert result[0][0] == Intent.CUSTOMERS

    def test_top_n_limit(self) -> None:
        result = classify_intents("What was my revenue and how are customers?", top_n=2)
        assert len(result) <= 2

    def test_no_match_returns_empty(self) -> None:
        result = classify_intents("Hello!")
        assert result == []

    def test_general_not_in_ranked(self) -> None:
        """GENERAL intent has no keywords, so it should never appear in ranked results."""
        result = classify_intents("Hello!")
        # GENERAL has no patterns, so matching score is 0
        assert all(score == 0 for _, score in result) or result == []