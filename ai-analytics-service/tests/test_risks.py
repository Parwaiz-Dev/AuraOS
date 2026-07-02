"""Tests for Risk Detector — Milestone 6."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.insights.risk_detector import (
    RiskDetector,
    RiskDetection,
    RiskResult,
    detect_risks,
)


class TestRiskResult:
    """Unit tests for RiskResult dataclass."""

    def test_risk_result_creation(self) -> None:
        r = RiskResult(
            type="churn_risk",
            severity="high",
            category="customer_retention",
            detail="Customer has not ordered in 45 days",
            recommendation="Send re-engagement email with discount",
            probability=0.75,
            detected_at="2026-06-01T08:00:00",
        )
        assert r.type == "churn_risk"
        assert r.severity == "high"
        assert r.category == "customer_retention"
        assert r.probability == 0.75
        assert "45 days" in r.detail

    def test_risk_result_defaults(self) -> None:
        r = RiskResult(
            type="stockout_risk",
            severity="medium",
            category="inventory",
            detail="Running low",
            recommendation="Reorder soon",
        )
        assert r.probability == 0.0
        assert r.detected_at == ""


class TestRiskDetection:
    """Unit tests for RiskDetection dataclass."""

    def test_empty_detection(self) -> None:
        d = RiskDetection(
            risks=[],
            total_detected=0,
        )
        assert len(d.risks) == 0
        assert d.total_detected == 0

    def test_detection_with_risks(self) -> None:
        r = RiskResult(
            type="churn_risk",
            severity="high",
            category="customer_retention",
            detail="Customer at risk of churning",
            recommendation="Re-engage",
            probability=0.75,
        )
        d = RiskDetection(
            risks=[r],
            total_detected=1,
        )
        assert len(d.risks) == 1
        assert d.total_detected == 1
        assert d.risks[0].type == "churn_risk"


class TestRiskDetectorChurn:
    """Unit tests for churn risk detection."""

    @pytest.mark.asyncio
    async def test_detect_churn_risk_empty(self) -> None:
        detector = RiskDetector()
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock())
        mock_db.execute.return_value.all.return_value = []

        results = await detector.detect_churn_risk(mock_db, "rest_1")
        assert results == []

    @pytest.mark.asyncio
    async def test_detect_churn_risk_with_inactive_customers(self) -> None:
        from datetime import datetime, timedelta
        from types import SimpleNamespace

        detector = RiskDetector()
        mock_db = AsyncMock()

        # Dates far in the past so churn window is triggered
        long_ago = datetime.utcnow() - timedelta(days=90)

        # First call: main query — use SimpleNamespace for attribute access
        main_result = MagicMock()
        main_result.all.return_value = [
            SimpleNamespace(
                id="cust_1", name="Alice", phone="555-0100",
                last_order_date=long_ago, total_orders=12, total_spent=4500.00,
            ),
            SimpleNamespace(
                id="cust_2", name="Bob", phone="555-0200",
                last_order_date=long_ago, total_orders=5, total_spent=1200.00,
            ),
        ]

        # Second call: review query for low-rated customers (5 columns)
        review_result = MagicMock()
        review_result.all.return_value = []

        mock_db.execute = AsyncMock(side_effect=[main_result, review_result])

        results = await detector.detect_churn_risk(mock_db, "rest_1")
        assert len(results) >= 1
        for r in results:
            assert isinstance(r, RiskResult)
            assert r.type == "churn_risk"


class TestRiskDetectorStockout:
    """Unit tests for stockout risk detection."""

    @pytest.mark.asyncio
    async def test_detect_stockout_risk_empty(self) -> None:
        detector = RiskDetector()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        results = await detector.detect_stockout_risk(mock_db, "rest_1")
        assert results == []


class TestRiskDetectorRevenueDecline:
    """Unit tests for revenue decline risk detection."""

    @pytest.mark.asyncio
    async def test_detect_revenue_decline_empty(self) -> None:
        detector = RiskDetector()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        results = await detector.detect_revenue_decline_risk(mock_db, "rest_1")
        assert results == []


class TestDetectRisksModule:
    """Tests for module-level detect_risks() function."""

    @pytest.mark.asyncio
    async def test_detect_risks_returns_detection(self) -> None:
        mock_db = AsyncMock()

        with patch(
            "app.insights.risk_detector.RiskDetector.detect_all",
            new_callable=AsyncMock,
        ) as mock_detect_all:
            mock_detect_all.return_value = RiskDetection(
                risks=[],
                total_detected=0,
            )

            result = await detect_risks(mock_db, "rest_1")

            assert isinstance(result, RiskDetection)
            assert result.total_detected == 0