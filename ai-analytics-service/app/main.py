"""
AuraOS AI Analytics Service — FastAPI application entry point.

Provides read-only ML-powered analytics on top of the AuraOS PostgreSQL
database.  Authenticates via JWT tokens issued by the Core API (Node.js).

Layout:
    /health         — liveness / readiness probe
    /api/v1/health  — authenticated health (validates DB + Redis)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.config.database import check_database_connection, close_database
from app.config.redis_client import close_redis, is_redis_available
from app.config.settings import settings


# ── Lifespan ────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Startup / shutdown events."""
    # Startup
    db_ok = await check_database_connection()
    redis_ok = await is_redis_available()
    print(f"✅ Database: {'connected' if db_ok else 'FAILED'}")
    print(f"✅ Redis:    {'connected' if redis_ok else 'unavailable (caching disabled)'}")
    yield
    # Shutdown
    await close_database()
    await close_redis()


# ── App ─────────────────────────────────────────────────────────────────────────


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Read-only AI/ML analytics microservice for the AuraOS restaurant platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened in production via env
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ─────────────────────────────────────────────────────────────────────

app.include_router(api_router, prefix="/api/v1")


# ── Global health (no auth) ─────────────────────────────────────────────────────


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, Any]:
    """Liveness probe — returns 200 if the process is running."""
    db_ok = await check_database_connection()
    redis_ok = await is_redis_available()
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected" if db_ok else "unreachable",
        "redis": "connected" if redis_ok else "unavailable",
    }


# ── Global exception handler ────────────────────────────────────────────────────


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler to avoid leaking stack traces."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )