"""Tests for Anomaly Detector — Milestone 6."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.insights.anomaly_detector import (
    AnomalyDetector,
    AnomalyDetection,
    AnomalyResult,
    detect_anomalies,
)


class TestAnomalyResult:
    """Unit tests for AnomalyResult dataclass."""

    def test_anomaly_result_creation(self) -> None:
        r = AnomalyResult(
            type="revenue_spike",
            severity="high",
            metric="revenue",
            current_value=5000.0,
            expected_value=4000.0,
            deviation_pct=25.0,
            detected_at="2026-06-01T00:00:00",
            description="Revenue spiked 25% above expected",
        )
        assert r.type == "revenue_spike"
        assert r.severity == "high"
        assert r.metric == "revenue"
        assert r.current_value == 5000.0
        assert r.expected_value == 4000.0
        assert r.deviation_pct == 25.0

    def test_anomaly_result_default_description(self) -> None:
        r = AnomalyResult(
            type="order_spike",
            severity="low",
            metric="orders",
            current_value=100.0,
            expected_value=100.0,
            deviation_pct=0.0,
            detected_at="2026-06-01T00:00:00",
        )
        assert r.description == ""
        assert r.severity == "low"


class TestAnomalyDetection:
    """Unit tests for AnomalyDetection dataclass."""

    def test_empty_detection(self) -> None:
        d = AnomalyDetection(
            anomalies=[],
            total_checked=3,
        )
        assert len(d.anomalies) == 0
        assert d.total_checked == 3

    def test_detection_with_anomalies(self) -> None:
        r = AnomalyResult(
            type="revenue_spike",
            severity="high",
            metric="revenue",
            current_value=5000.0,
            expected_value=4000.0,
            deviation_pct=25.0,
            detected_at="2026-06-01T00:00:00",
        )
        d = AnomalyDetection(
            anomalies=[r],
            total_checked=3,
        )
        assert len(d.anomalies) == 1
        assert d.anomalies[0].metric == "revenue"


class TestIsolationForest:
    """Unit tests for Isolation Forest scoring."""

    def test_isolation_forest_empty_data(self) -> None:
        detector = AnomalyDetector()
        scores = detector._isolation_forest_score([])
        assert scores == []

    def test_isolation_forest_single_point(self) -> None:
        detector = AnomalyDetector()
        scores = detector._isolation_forest_score([100.0])
        assert len(scores) == 1
        assert scores[0] == 0.0

    def test_isolation_forest_normal_data(self) -> None:
        detector = AnomalyDetector()
        data = [100.0, 102.0, 98.0, 101.0, 99.0, 100.0, 103.0, 97.0]
        scores = detector._isolation_forest_score(data)
        assert len(scores) == len(data)
        for s in scores:
            assert -1.0 <= s <= 1.0

    def test_isolation_forest_with_outlier(self) -> None:
        detector = AnomalyDetector()
        data = [100.0, 102.0, 98.0, 101.0, 99.0, 500.0, 100.0, 97.0]
        scores = detector._isolation_forest_score(data)
        assert len(scores) == len(data)
        outlier_idx = 5  # 500.0
        outlier_score = abs(scores[outlier_idx])
        for i, s in enumerate(scores):
            if i != outlier_idx:
                assert abs(s) <= outlier_score or abs(s) < 0.6


class TestZScore:
    """Unit tests for Z-score fallback."""

    def test_zscore_empty_data(self) -> None:
        detector = AnomalyDetector()
        scores = detector._zscore_anomaly_scores([])
        assert scores == []

    def test_zscore_single_point(self) -> None:
        detector = AnomalyDetector()
        scores = detector._zscore_anomaly_scores([100.0])
        assert len(scores) == 1
        assert scores[0] == 0.0

    def test_zscore_constant_data(self) -> None:
        detector = AnomalyDetector()
        scores = detector._zscore_anomaly_scores([50.0, 50.0, 50.0, 50.0])
        assert len(scores) == 4
        for s in scores:
            assert s == 0.0

    def test_zscore_normal_data(self) -> None:
        detector = AnomalyDetector()
        data = [100.0, 110.0, 90.0, 105.0, 95.0]
        scores = detector._zscore_anomaly_scores(data)
        assert len(scores) == len(data)

    def test_zscore_with_outlier(self) -> None:
        detector = AnomalyDetector()
        data = [100.0, 102.0, 98.0, 101.0, 300.0]
        scores = detector._zscore_anomaly_scores(data)
        outlier_score = abs(scores[4])
        for i in range(4):
            assert abs(scores[i]) < outlier_score


class TestDetectAnomaliesModule:
    """Tests for module-level detect_anomalies() function."""

    @pytest.mark.asyncio
    async def test_detect_anomalies_returns_detection(self) -> None:
        """Module-level function should return AnomalyDetection."""
        mock_db = AsyncMock()

        with patch(
            "app.insights.anomaly_detector.AnomalyDetector.detect_all",
            new_callable=AsyncMock,
        ) as mock_detect_all:
            mock_detect_all.return_value = AnomalyDetection(
                anomalies=[],
                total_checked=3,
            )

            result = await detect_anomalies(mock_db, "rest_1")

            assert isinstance(result, AnomalyDetection)
            assert result.total_checked == 3
            assert len(result.anomalies) == 0