"""Job Registry — runtime management of scheduled training jobs.

Provides manual trigger, pause, resume, and status inspection.
"""

from __future__ import annotations

import logging
from typing import Any

from app.scheduler.scheduler import get_scheduler

logger = logging.getLogger(__name__)


def list_jobs() -> list[dict[str, Any]]:
    """Return a list of all registered jobs with their status."""
    sched = get_scheduler()
    if sched is None:
        return []

    jobs = []
    for job in sched.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        })
    return jobs


def pause_job(job_id: str) -> bool:
    """Pause a single job by ID. Returns True if successful."""
    sched = get_scheduler()
    if sched is None:
        logger.warning("Cannot pause job %s: scheduler not running", job_id)
        return False
    try:
        sched.pause_job(job_id)
        logger.info("Paused job: %s", job_id)
        return True
    except Exception:
        logger.exception("Failed to pause job: %s", job_id)
        return False


def resume_job(job_id: str) -> bool:
    """Resume a paused job by ID. Returns True if successful."""
    sched = get_scheduler()
    if sched is None:
        logger.warning("Cannot resume job %s: scheduler not running", job_id)
        return False
    try:
        sched.resume_job(job_id)
        logger.info("Resumed job: %s", job_id)
        return True
    except Exception:
        logger.exception("Failed to resume job: %s", job_id)
        return False


async def trigger_job(job_id: str) -> bool:
    """Trigger a single job immediately. Returns True if successful."""
    sched = get_scheduler()
    if sched is None:
        logger.warning("Cannot trigger job %s: scheduler not running", job_id)
        return False

    job = sched.get_job(job_id)
    if job is None:
        logger.warning("Job not found: %s", job_id)
        return False

    try:
        # The job function expects 'restaurants' kwarg — discover them now
        from app.scheduler.cron_jobs import _discover_restaurants

        restaurants = await _discover_restaurants()
        if not restaurants:
            logger.warning("No restaurants found — cannot trigger job %s", job_id)
            return False

        await job.func(restaurants=restaurants)
        logger.info("Manually triggered job: %s", job_id)
        return True
    except Exception:
        logger.exception("Manual trigger failed for job: %s", job_id)
        return False


def get_job_status(job_id: str) -> dict[str, Any] | None:
    """Return status info for a single job, or None if not found."""
    sched = get_scheduler()
    if sched is None:
        return None

    job = sched.get_job(job_id)
    if job is None:
        return None

    return {
        "id": job.id,
        "name": job.name,
        "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
        "trigger": str(job.trigger),
        "paused": bool(job.next_run_time is None and sched.get_job(job_id) is not None),
    }