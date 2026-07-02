"""Tests for Context Builder — Milestone 5."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.copilot.context_builder import build_context
from app.copilot.intent_classifier import Intent


class TestBuildContext:
    """Unit tests for build_context() with mocked services."""

    @pytest.mark.asyncio
    async def test_build_context_returns_dict(self) -> None:
        """build_context should always return a dict with intent and data."""
        mock_db = AsyncMock()
        context = await build_context(mock_db, "rest-123", "Hello!")
        assert isinstance(context, dict)
        assert "intent" in context
        assert "generated_at" in context
        assert "data" in context

    @pytest.mark.asyncio
    async def test_build_context_general_intent(self) -> None:
        """GENERAL intent should trigger all service calls."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "Hello!")
            # All services should be called for GENERAL
            mock_rev.assert_called_once()
            mock_dash.assert_called_once()
            mock_fc.assert_called_once()
            mock_cust.assert_called_once()
            mock_rec.assert_called_once()
            mock_menu.assert_called_once()
            mock_ops.assert_called_once()
            mock_inv.assert_called_once()

    @pytest.mark.asyncio
    async def test_build_context_revenue_intent(self) -> None:
        """REVENUE intent should call revenue and dashboard only."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "What was my revenue?")
            mock_rev.assert_called_once()
            mock_dash.assert_called_once()
            mock_fc.assert_not_called()
            mock_cust.assert_not_called()
            mock_rec.assert_not_called()
            mock_menu.assert_not_called()
            mock_ops.assert_not_called()
            mock_inv.assert_not_called()

    @pytest.mark.asyncio
    async def test_build_context_forecast_intent(self) -> None:
        """FORECAST intent should call forecast context."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "Forecast next week")
            mock_rev.assert_called_once()
            mock_dash.assert_called_once()
            mock_fc.assert_called_once()
            mock_cust.assert_not_called()
            mock_rec.assert_not_called()
            mock_menu.assert_not_called()
            mock_ops.assert_not_called()
            mock_inv.assert_not_called()

    @pytest.mark.asyncio
    async def test_build_context_inventory_intent(self) -> None:
        """INVENTORY intent should call only inventory context."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "What is my stock level?")
            mock_rev.assert_not_called()
            mock_dash.assert_not_called()
            mock_fc.assert_not_called()
            mock_cust.assert_not_called()
            mock_rec.assert_not_called()
            mock_menu.assert_not_called()
            mock_ops.assert_not_called()
            mock_inv.assert_called_once()

    @pytest.mark.asyncio
    async def test_build_context_customers_intent(self) -> None:
        """CUSTOMERS intent should call customer context."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "Who are my VIPs?")
            mock_rev.assert_not_called()
            mock_dash.assert_not_called()
            mock_fc.assert_not_called()
            mock_cust.assert_called_once()
            mock_rec.assert_not_called()
            mock_menu.assert_not_called()
            mock_ops.assert_not_called()
            mock_inv.assert_not_called()

    @pytest.mark.asyncio
    async def test_build_context_menu_intent(self) -> None:
        """MENU intent should call menu and recommendation context."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "What are my top items?")
            mock_rev.assert_not_called()
            mock_dash.assert_not_called()
            mock_fc.assert_not_called()
            mock_cust.assert_not_called()
            mock_rec.assert_called_once()
            mock_menu.assert_called_once()
            mock_ops.assert_not_called()
            mock_inv.assert_not_called()

    @pytest.mark.asyncio
    async def test_build_context_operations_intent(self) -> None:
        """OPERATIONS intent should call operations context."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "What is the wait time?")
            mock_rev.assert_called_once()
            mock_dash.assert_called_once()
            mock_fc.assert_not_called()
            mock_cust.assert_not_called()
            mock_rec.assert_not_called()
            mock_menu.assert_not_called()
            mock_ops.assert_called_once()
            mock_inv.assert_not_called()

    @pytest.mark.asyncio
    async def test_build_context_recommendations_intent(self) -> None:
        """RECOMMENDATIONS intent should call recommendation context."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context", new_callable=AsyncMock
        ) as mock_rev, patch(
            "app.copilot.context_builder._add_dashboard_context", new_callable=AsyncMock
        ) as mock_dash, patch(
            "app.copilot.context_builder._add_forecast_context", new_callable=AsyncMock
        ) as mock_fc, patch(
            "app.copilot.context_builder._add_customer_context", new_callable=AsyncMock
        ) as mock_cust, patch(
            "app.copilot.context_builder._add_recommendation_context", new_callable=AsyncMock
        ) as mock_rec, patch(
            "app.copilot.context_builder._add_menu_context", new_callable=AsyncMock
        ) as mock_menu, patch(
            "app.copilot.context_builder._add_operations_context", new_callable=AsyncMock
        ) as mock_ops, patch(
            "app.copilot.context_builder._add_inventory_context", new_callable=AsyncMock
        ) as mock_inv:
            context = await build_context(mock_db, "rest-123", "What do you recommend?")
            mock_rev.assert_not_called()
            mock_dash.assert_not_called()
            mock_fc.assert_not_called()
            mock_cust.assert_not_called()
            mock_rec.assert_called_once()
            mock_menu.assert_not_called()
            mock_ops.assert_not_called()
            mock_inv.assert_not_called()

    @pytest.mark.asyncio
    async def test_build_context_handles_exceptions_gracefully(self) -> None:
        """build_context should not raise even if a service fails."""
        mock_db = AsyncMock()
        with patch(
            "app.copilot.context_builder._add_revenue_context",
            new_callable=AsyncMock,
            side_effect=Exception("Service down"),
        ):
            context = await build_context(mock_db, "rest-123", "What was my revenue?")
            assert isinstance(context, dict)
            assert "intent" in context
            assert "data" in context