"""APScheduler setup and lifecycle management.

Provides start_scheduler() / stop_scheduler() called from the FastAPI lifespan.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config.settings import settings
from app.scheduler.cron_jobs import (
    ALL_JOBS,
    _discover_restaurants,
)

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def _build_scheduler() -> AsyncIOScheduler:
    """Create and configure the APScheduler instance."""
    sched = AsyncIOScheduler(
        timezone=settings.SCHEDULER_TIMEZONE,
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 300,  # 5 minutes grace
        },
    )
    return sched


async def _register_jobs(sched: AsyncIOScheduler) -> None:
    """Register all scheduled training jobs.

    Each job runs for every restaurant that has data.
    """
    restaurants = await _discover_restaurants()
    if not restaurants:
        logger.warning("No restaurants found — skipping job registration")
        return

    for job_def in ALL_JOBS:
        trigger = CronTrigger.from_crontab(job_def["cron"], timezone=settings.SCHEDULER_TIMEZONE)
        sched.add_job(
            job_def["func"],
            trigger=trigger,
            id=job_def["id"],
            name=job_def["name"],
            kwargs={"restaurants": restaurants},
            replace_existing=True,
        )
        logger.info(
            "Registered job '%s' (cron=%s) for %d restaurants",
            job_def["name"],
            job_def["cron"],
            len(restaurants),
        )


async def start_scheduler() -> None:
    """Start the APScheduler. Called during FastAPI startup."""
    global _scheduler

    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler disabled via SCHEDULER_ENABLED=False")
        return

    _scheduler = _build_scheduler()
    await _register_jobs(_scheduler)
    _scheduler.start()
    logger.info("APScheduler started with %d jobs", len(ALL_JOBS))


async def stop_scheduler() -> None:
    """Shut down the APScheduler gracefully. Called during FastAPI shutdown."""
    global _scheduler

    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler shut down")


def get_scheduler() -> AsyncIOScheduler | None:
    """Return the current scheduler instance, or None."""
    return _scheduler


def is_scheduler_running() -> bool:
    """Return True if the scheduler is running."""
    return _scheduler is not None and _scheduler.running