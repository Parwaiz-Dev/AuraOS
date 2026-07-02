"""Tests for model registry — metadata, versioning, and cleanup."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app.config.settings import settings
from app.model_registry.metadata import (
    MODEL_STATUS_ACTIVE,
    MODEL_STATUS_ARCHIVED,
    MODEL_STATUS_FAILED,
    MODEL_STATUS_TRAINING,
    create_metadata,
    get_metadata,
    list_all_metadata,
    save_metadata,
    set_failed_status,
    set_training_status,
)
from app.model_registry.registry import (
    ALL_MODEL_NAMES,
    get_all_models_summary,
    get_model_health_map,
    get_model_status,
    register_training_failure,
    register_training_start,
    register_training_success,
)
from app.model_registry.version_manager import (
    archive_old_versions,
    clear_versions,
    get_current_version,
    increment_version,
    list_versions,
)

TEST_RESTAURANT = "test-registry-restaurant"
TEST_MODEL = "revenue_forecast"


# ── Fixtures ─────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clean_registry() -> None:
    """Clean up test registry files before each test."""
    registry_dir = Path(settings.MODEL_REGISTRY_DIR)
    for pattern in [f"{TEST_MODEL}_{TEST_RESTAURANT}*", "test_*"]:
        for f in registry_dir.glob(pattern):
            if f.is_file():
                f.unlink()
    versions_dir = registry_dir / "versions"
    if versions_dir.exists():
        for f in versions_dir.glob(f"{TEST_MODEL}_{TEST_RESTAURANT}*"):
            if f.is_file():
                f.unlink()
    clear_versions(TEST_MODEL, TEST_RESTAURANT)


# ── Metadata Tests ───────────────────────────────────────────────────────────────


class TestMetadata:
    """Tests for model registry metadata operations."""

    def test_create_metadata_returns_correct_structure(self):
        """create_metadata should return a dict with all expected fields."""
        entry = create_metadata(TEST_MODEL, TEST_RESTAURANT, "v1", 500, {"accuracy": 0.95})
        assert entry["model_name"] == TEST_MODEL
        assert entry["restaurant_id"] == TEST_RESTAURANT
        assert entry["version"] == "v1"
        assert entry["status"] == MODEL_STATUS_ACTIVE
        assert entry["training_rows"] == 500
        assert entry["metrics"] == {"accuracy": 0.95}
        assert "created_at" in entry
        assert entry["drift_checks"] == []

    def test_set_training_status_creates_file(self):
        """set_training_status should write a JSON file to disk."""
        set_training_status(TEST_MODEL, TEST_RESTAURANT)
        entry = get_metadata(TEST_MODEL, TEST_RESTAURANT)
        assert entry is not None
        assert entry["status"] == MODEL_STATUS_TRAINING

    def test_set_failed_status_updates_entry(self):
        """set_failed_status should update an existing entry to FAILED."""
        set_training_status(TEST_MODEL, TEST_RESTAURANT)
        set_failed_status(TEST_MODEL, TEST_RESTAURANT, "Not enough data")
        entry = get_metadata(TEST_MODEL, TEST_RESTAURANT)
        assert entry is not None
        assert entry["status"] == MODEL_STATUS_FAILED
        assert entry["error"] == "Not enough data"

    def test_set_failed_status_creates_if_no_entry(self):
        """set_failed_status should create a file if none exists."""
        set_failed_status(TEST_MODEL, TEST_RESTAURANT, "Unknown error")
        entry = get_metadata(TEST_MODEL, TEST_RESTAURANT)
        assert entry is not None
        assert entry["status"] == MODEL_STATUS_FAILED

    def test_save_and_get_metadata_roundtrip(self):
        """save_metadata and get_metadata should round-trip correctly."""
        entry = create_metadata(TEST_MODEL, TEST_RESTAURANT, "v2", 1000, {"rmse": 0.12})
        save_metadata(entry)
        loaded = get_metadata(TEST_MODEL, TEST_RESTAURANT)
        assert loaded is not None
        assert loaded["version"] == "v2"
        assert loaded["training_rows"] == 1000

    def test_get_metadata_nonexistent_returns_none(self):
        """get_metadata should return None for unknown model/restaurant."""
        result = get_metadata("nonexistent", "nonexistent")
        assert result is None

    def test_list_all_metadata_returns_all_entries(self):
        """list_all_metadata should return all saved metadata entries."""
        save_metadata(create_metadata(TEST_MODEL, TEST_RESTAURANT, "v1", 100, {}))
        entries = list_all_metadata()
        assert len(entries) >= 1
        assert any(e["model_name"] == TEST_MODEL for e in entries)


# ── Version Manager Tests ────────────────────────────────────────────────────────


class TestVersionManager:
    """Tests for semantic versioning operations."""

    def test_increment_version_starts_at_v1(self):
        """First increment should return 'v1'."""
        version = increment_version(TEST_MODEL, TEST_RESTAURANT)
        assert version == "v1"

    def test_increment_version_sequential(self):
        """Sequential increments should produce v1, v2, v3."""
        assert increment_version(TEST_MODEL, TEST_RESTAURANT) == "v1"
        assert increment_version(TEST_MODEL, TEST_RESTAURANT) == "v2"
        assert increment_version(TEST_MODEL, TEST_RESTAURANT) == "v3"

    def test_get_current_version_returns_latest_active(self):
        """get_current_version should return the latest ACTIVE version."""
        increment_version(TEST_MODEL, TEST_RESTAURANT)  # v1
        increment_version(TEST_MODEL, TEST_RESTAURANT)  # v2
        current = get_current_version(TEST_MODEL, TEST_RESTAURANT)
        assert current == "v2"

    def test_get_current_version_returns_none_when_empty(self):
        """get_current_version should return None with no versions."""
        assert get_current_version(TEST_MODEL, TEST_RESTAURANT) is None

    def test_list_versions_returns_all_entries(self):
        """list_versions should return all version entries."""
        increment_version(TEST_MODEL, TEST_RESTAURANT)
        increment_version(TEST_MODEL, TEST_RESTAURANT)
        versions = list_versions(TEST_MODEL, TEST_RESTAURANT)
        assert len(versions) == 2

    def test_archive_old_versions_respects_retention(self):
        """archive_old_versions should archive versions beyond the retention limit."""
        for _ in range(5):
            increment_version(TEST_MODEL, TEST_RESTAURANT)
        archived = archive_old_versions(TEST_MODEL, TEST_RESTAURANT)
        versions = list_versions(TEST_MODEL, TEST_RESTAURANT)
        active = [v for v in versions if v.get("status") == "ACTIVE"]
        assert len(active) <= settings.MODEL_RETENTION_VERSIONS
        assert len(archived) > 0

    def test_clear_versions_removes_all(self):
        """clear_versions should remove all version entries."""
        increment_version(TEST_MODEL, TEST_RESTAURANT)
        increment_version(TEST_MODEL, TEST_RESTAURANT)
        clear_versions(TEST_MODEL, TEST_RESTAURANT)
        assert list_versions(TEST_MODEL, TEST_RESTAURANT) == []


# ── Registry Tests ───────────────────────────────────────────────────────────────


class TestRegistry:
    """Tests for the central registry operations."""

    def test_register_training_start_returns_version(self):
        """register_training_start should return a version string."""
        version = register_training_start(TEST_MODEL, TEST_RESTAURANT)
        assert version.startswith("v")
        assert version == "v1"

    def test_register_training_success_updates_metadata(self):
        """register_training_success should create an ACTIVE metadata entry."""
        version = register_training_start(TEST_MODEL, TEST_RESTAURANT)
        register_training_success(TEST_MODEL, TEST_RESTAURANT, version, 300, {"accuracy": 0.88})
        status = get_model_status(TEST_MODEL, TEST_RESTAURANT)
        assert status == MODEL_STATUS_ACTIVE

    def test_register_training_failure_updates_status(self):
        """register_training_failure should mark the model as FAILED."""
        register_training_start(TEST_MODEL, TEST_RESTAURANT)
        register_training_failure(TEST_MODEL, TEST_RESTAURANT, "Data error")
        status = get_model_status(TEST_MODEL, TEST_RESTAURANT)
        assert status == MODEL_STATUS_FAILED

    def test_get_model_status_unknown(self):
        """get_model_status should return UNKNOWN for untrained models."""
        status = get_model_status("nonexistent", "nonexistent")
        assert status == "UNKNOWN"

    def test_all_model_names_contains_all_expected(self):
        """ALL_MODEL_NAMES should contain all 6 model names."""
        assert "revenue_forecast" in ALL_MODEL_NAMES
        assert "order_forecast" in ALL_MODEL_NAMES
        assert "customer_segmentation" in ALL_MODEL_NAMES
        assert "recommendation_engine" in ALL_MODEL_NAMES
        assert "wait_time_prediction" in ALL_MODEL_NAMES
        assert "inventory_prediction" in ALL_MODEL_NAMES
        assert len(ALL_MODEL_NAMES) == 6

    def test_get_all_models_summary_returns_expected_keys(self):
        """get_all_models_summary should return totalModels, healthyModels, etc."""
        summary = get_all_models_summary()
        assert "totalModels" in summary
        assert "healthyModels" in summary
        assert "failedModels" in summary
        assert "averageAccuracy" in summary

    def test_get_model_health_map_returns_all_models(self):
        """get_model_health_map should return entries for all 6 model names."""
        health = get_model_health_map()
        assert len(health) == 6
        for name in ALL_MODEL_NAMES:
            assert name in health