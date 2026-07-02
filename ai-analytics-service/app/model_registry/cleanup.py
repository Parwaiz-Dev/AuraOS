"""Model Cleanup — removes stale cache entries and cleans up stale model files."""

from __future__ import annotations

import logging
from pathlib import Path

from app.config.settings import settings

logger = logging.getLogger(__name__)


async def cleanup_stale_cache(
    model_name: str | None = None,
    restaurant_id: str | None = None,
) -> int:
    """Delete stale Redis cache keys for models.

    Parameters
    ----------
    model_name : str | None
        If provided, only clean cache for this model. Otherwise clean all.
    restaurant_id : str | None
        If provided, only clean cache for this restaurant. Otherwise clean all.

    Returns
    -------
    int
        Number of keys deleted, or -1 if Redis is unavailable.
    """
    from app.config.redis_client import is_redis_available, get_redis

    if not await is_redis_available():
        logger.warning("Redis unavailable — skipping cache cleanup")
        return -1

    redis = await get_redis()

    # Build scan pattern
    if model_name and restaurant_id:
        pattern = f"*:{model_name}:{restaurant_id}:*"
    elif model_name:
        pattern = f"*:{model_name}:*"
    elif restaurant_id:
        pattern = f"*:{restaurant_id}:*"
    else:
        pattern = "*"

    deleted = 0
    cursor = 0
    while True:
        cursor, keys = await redis.scan(cursor, match=pattern, count=100)
        if keys:
            deleted += await redis.delete(*keys)
        if cursor == 0:
            break

    if deleted:
        logger.info("Cleaned %d stale cache keys (pattern=%s)", deleted, pattern)
    return deleted


def cleanup_model_files(
    model_name: str | None = None,
    restaurant_id: str | None = None,
) -> int:
    """Remove archived model files from disk.

    Returns
    -------
    int
        Number of files removed.
    """
    models_dir = Path(settings.MODELS_DIR)
    if not models_dir.exists():
        return 0

    removed = 0
    for model_dir in models_dir.iterdir():
        if not model_dir.is_dir():
            continue
        if model_name and model_dir.name != model_name:
            continue
        for model_file in model_dir.glob("archived_*"):
            if restaurant_id and restaurant_id not in model_file.name:
                continue
            try:
                model_file.unlink()
                removed += 1
                logger.info("Removed archived model file: %s", model_file)
            except OSError as exc:
                logger.warning("Failed to remove %s: %s", model_file, exc)

    return removed


async def cleanup_all() -> dict[str, int]:
    """Run full cleanup: stale cache + archived model files.

    Returns
    -------
    dict
        {'cache_keys_deleted': int, 'files_removed': int}
    """
    cache_deleted = await cleanup_stale_cache()
    files_removed = cleanup_model_files()
    return {"cache_keys_deleted": cache_deleted, "files_removed": files_removed}