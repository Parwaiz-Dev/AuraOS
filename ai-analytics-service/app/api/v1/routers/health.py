"""
Health endpoint for the AI Analytics service.

GET /api/v1/health
    Authenticated probe — returns database and Redis connectivity status
    plus basic service metadata.  Requires a valid JWT Bearer token.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config.database import check_database_connection
from app.config.redis_client import is_redis_available
from app.config.security import CurrentUser
from app.config.settings import settings

router = APIRouter()


@router.get("/health", response_model=dict[str, Any])
async def authenticated_health(user: CurrentUser) -> dict[str, Any]:
    """
    Authenticated readiness probe.

    Validates the JWT, then checks DB and Redis connectivity.
    Also returns the authenticated user's restaurant context so the
    caller can verify multi-tenancy is wired correctly.
    """
    db_ok = await check_database_connection()
    redis_ok = await is_redis_available()

    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected" if db_ok else "unreachable",
        "redis": "connected" if redis_ok else "unavailable",
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "restaurantId": user.restaurantId,
        },
    }