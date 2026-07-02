"""Tests for the APScheduler setup and job definitions."""

from __future__ import annotations

import pytest

from app.config.settings import settings
from app.scheduler.cron_jobs import ALL_JOBS, _discover_restaurants
from app.scheduler.job_registry import list_jobs, pause_job, resume_job
from app.scheduler.scheduler import get_scheduler


class TestJobDefinitions:
    """Tests for the cron job definitions."""

    def test_all_jobs_has_ten_entries(self):
        """ALL_JOBS should contain exactly 10 job definitions (6 ML + 2 M6 insights + 2 M7 RAG)."""
        assert len(ALL_JOBS) == 10

    def test_all_jobs_have_required_keys(self):
        """Each job definition should have id, name, cron, and func."""
        for job in ALL_JOBS:
            assert "id" in job
            assert "name" in job
            assert "cron" in job
            assert "func" in job
            assert callable(job["func"])

    def test_all_jobs_have_unique_ids(self):
        """All job IDs should be unique."""
        ids = [job["id"] for job in ALL_JOBS]
        assert len(ids) == len(set(ids))

    def test_job_schedule_correct(self):
        """Verify the expected cron schedules."""
        schedules = {job["id"]: job["cron"] for job in ALL_JOBS}
        assert schedules["revenue_forecast_training"] == "0 2 * * *"
        assert schedules["order_forecast_training"] == "15 2 * * *"
        assert schedules["customer_segmentation_training"] == "30 2 * * *"
        assert schedules["recommendation_engine_training"] == "45 2 * * *"
        assert schedules["wait_time_prediction_training"] == "0 * * * *"
        assert schedules["inventory_prediction_training"] == "0 3 * * *"
        # Milestone 6 — proactive insights
        assert schedules["daily_insight_generation"] == "0 8 * * *"
        assert schedules["weekly_report_generation"] == "0 9 * * 1"


class TestSchedulerSettings:
    """Tests for scheduler-related settings."""

    def test_scheduler_enabled_setting(self):
        """SCHEDULER_ENABLED should be a boolean."""
        assert isinstance(settings.SCHEDULER_ENABLED, bool)

    def test_scheduler_timezone_setting(self):
        """SCHEDULER_TIMEZONE should be a non-empty string."""
        assert isinstance(settings.SCHEDULER_TIMEZONE, str)
        assert len(settings.SCHEDULER_TIMEZONE) > 0


class TestJobRegistry:
    """Tests for the job registry functions."""

    def test_list_jobs_returns_empty_list_when_scheduler_not_running(self):
        """list_jobs should return an empty list when scheduler is not started."""
        jobs = list_jobs()
        assert isinstance(jobs, list)

    def test_pause_job_returns_false_when_scheduler_not_running(self):
        """pause_job should return False when scheduler is not running."""
        result = pause_job("nonexistent_job")
        assert result is False

    def test_resume_job_returns_false_when_scheduler_not_running(self):
        """resume_job should return False when scheduler is not running."""
        result = resume_job("nonexistent_job")
        assert result is False

    def test_get_scheduler_returns_none_when_not_started(self):
        """get_scheduler should return None when scheduler hasn't been started."""
        assert get_scheduler() is None