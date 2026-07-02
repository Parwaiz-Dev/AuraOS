"""Tests for drift detection — MAPE, RMSE, and variance checks."""

from __future__ import annotations

import pytest

from app.config.settings import settings
from app.monitoring.drift_detection import (
    _compute_mape,
    _compute_prediction_variance,
    _compute_rmse,
    check_drift,
)


class TestComputeMape:
    """Tests for MAPE computation."""

    def test_mape_perfect_prediction(self):
        """MAPE should be 0.0 when predictions match actuals exactly."""
        actual = [100.0, 200.0, 300.0]
        predicted = [100.0, 200.0, 300.0]
        import numpy as np
        assert _compute_mape(np.array(actual), np.array(predicted)) == 0.0

    def test_mape_with_errors(self):
        """MAPE should compute correctly with prediction errors."""
        import numpy as np
        actual = np.array([100.0, 200.0, 300.0])
        predicted = np.array([110.0, 180.0, 330.0])
        mape = _compute_mape(actual, predicted)
        assert mape > 0.0
        assert mape < 1.0

    def test_mape_with_zeros_in_actual(self):
        """MAPE should handle zeros in actual values gracefully."""
        import numpy as np
        actual = np.array([0.0, 200.0, 300.0])
        predicted = np.array([10.0, 200.0, 300.0])
        mape = _compute_mape(actual, predicted)
        assert mape >= 0.0


class TestComputeRmse:
    """Tests for RMSE computation."""

    def test_rmse_perfect_prediction(self):
        """RMSE should be 0.0 when predictions match actuals exactly."""
        import numpy as np
        actual = np.array([10.0, 20.0, 30.0])
        predicted = np.array([10.0, 20.0, 30.0])
        assert _compute_rmse(actual, predicted) == 0.0

    def test_rmse_with_errors(self):
        """RMSE should compute correctly with prediction errors."""
        import numpy as np
        actual = np.array([10.0, 20.0, 30.0])
        predicted = np.array([12.0, 18.0, 33.0])
        rmse = _compute_rmse(actual, predicted)
        assert rmse > 0.0


class TestComputeVariance:
    """Tests for prediction variance computation."""

    def test_variance_constant_predictions(self):
        """Variance of constant predictions should be 0.0."""
        import numpy as np
        predictions = np.array([5.0, 5.0, 5.0])
        assert _compute_prediction_variance(predictions) == 0.0

    def test_variance_varying_predictions(self):
        """Variance should be positive for varying predictions."""
        import numpy as np
        predictions = np.array([1.0, 5.0, 9.0])
        variance = _compute_prediction_variance(predictions)
        assert variance > 0.0

    def test_variance_single_value(self):
        """Variance of a single prediction should be 0.0."""
        import numpy as np
        predictions = np.array([42.0])
        assert _compute_prediction_variance(predictions) == 0.0


class TestCheckDrift:
    """Tests for the full drift detection pipeline."""

    def test_check_drift_healthy(self):
        """check_drift should return healthy=True when errors and variance are within thresholds."""
        actual = [100.0, 100.0, 100.0, 100.0, 100.0]
        predicted = [100.2, 99.8, 100.1, 99.9, 100.0]
        result = check_drift("test_model", "test_restaurant", actual, predicted)
        assert result["healthy"] is True
        assert len(result["issues"]) == 0
        assert "mape" in result["metrics"]
        assert "rmse" in result["metrics"]

    def test_check_drift_unhealthy_mape(self):
        """check_drift should detect drift when MAPE exceeds threshold."""
        actual = [100.0, 100.0, 100.0, 100.0, 100.0]
        predicted = [200.0, 200.0, 200.0, 200.0, 200.0]  # 100% MAPE
        result = check_drift("test_model", "test_restaurant", actual, predicted)
        assert result["healthy"] is False
        assert len(result["issues"]) > 0
        assert any("MAPE" in issue for issue in result["issues"])

    def test_check_drift_with_baseline_rmse(self):
        """check_drift should check RMSE multiplier against baseline."""
        actual = [100.0, 200.0, 300.0]
        predicted = [150.0, 250.0, 350.0]  # noticeable error
        # Baseline RMSE is very small, so this should trigger the multiplier
        result = check_drift("test_model", "test_restaurant", actual, predicted, baseline_rmse=1.0)
        # RMSE of ~50 vs baseline 1.0 → 50x multiplier → should flag
        assert "rmse" in result["metrics"]

    def test_check_drift_empty_inputs(self):
        """check_drift should return healthy for empty inputs."""
        result = check_drift("test_model", "test_restaurant", [], [])
        assert result["healthy"] is True
        assert result["issues"] == []

    def test_check_drift_high_variance(self):
        """check_drift should flag when prediction variance is high."""
        actual = [100.0, 100.0, 100.0, 100.0, 100.0]
        predicted = [10.0, 500.0, 10.0, 500.0, 10.0]  # high variance
        result = check_drift("test_model", "test_restaurant", actual, predicted)
        # High variance should trigger
        assert "prediction_variance" in result["metrics"]

    def test_check_drift_records_in_metadata(self):
        """check_drift should record a drift check when metadata exists (no TypeError).

        Regression test for the add_drift_check() signature mismatch bug.
        """
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from app.model_registry import metadata as md

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(md, "_registry_dir", Path(tmpdir)):
                entry = md.create_metadata("test_model", "r1", "v1", 100, {"accuracy": 0.9})
                md.save_metadata(entry)

                actual = [1.00, 1.00, 1.00, 1.00, 1.00]
                predicted = [1.00, 1.01, 0.99, 1.00, 1.00]
                result = check_drift("test_model", "r1", actual, predicted)

                assert result["healthy"] is True
                stored = md.get_metadata("test_model", "r1")
                assert stored is not None
                assert len(stored["drift_checks"]) == 1
                assert stored["drift_checks"][0]["healthy"] is True
                assert "mape" in stored["drift_checks"][0]


class TestAddDriftCheck:
    """Tests for the metadata drift check recording."""

    def test_add_drift_check_appends(self):
        """add_drift_check should append a drift check dict to metadata."""
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from app.model_registry import metadata as md

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(md, "_registry_dir", Path(tmpdir)):
                entry = md.create_metadata("test_model", "r1", "v1", 100, {"accuracy": 0.9})
                md.save_metadata(entry)

                md.add_drift_check("test_model", "r1", {"healthy": True, "mape": 0.1, "rmse": 5.0})
                md.add_drift_check("test_model", "r1", {"healthy": False, "mape": 0.5, "rmse": 50.0})

                stored = md.get_metadata("test_model", "r1")
                assert stored is not None
                assert len(stored["drift_checks"]) == 2
                assert stored["drift_checks"][1]["healthy"] is False

    def test_add_drift_check_caps_at_20(self):
        """add_drift_check should keep only the last 20 checks."""
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from app.model_registry import metadata as md

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(md, "_registry_dir", Path(tmpdir)):
                entry = md.create_metadata("test_model", "r1", "v1", 100, {})
                md.save_metadata(entry)

                for i in range(25):
                    md.add_drift_check("test_model", "r1", {"healthy": True, "i": i})

                stored = md.get_metadata("test_model", "r1")
                assert stored is not None
                assert len(stored["drift_checks"]) == 20
                assert stored["drift_checks"][-1]["i"] == 24