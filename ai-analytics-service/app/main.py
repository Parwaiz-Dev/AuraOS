"""
AuraOS AI Analytics Service — FastAPI application entry point.

Provides read-only ML-powered analytics on top of the AuraOS PostgreSQL
database.  Authenticates via JWT tokens issued by the Core API (Node.js).

Layout:
    /health         — liveness / readiness probe
    /api/v1/health  — authenticated health (validates DB + Redis)
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.config.database import check_database_connection, close_database
from app.config.redis_client import close_redis, is_redis_available
from app.config.settings import settings

logger = logging.getLogger("app.main")


# ── Lifespan ────────────────────────────────────────────────────────────────────


async def _safe_start(name: str, coro_or_none) -> None:
    """Run a startup step, logging and swallowing any failure so that one broken
    optional subsystem cannot take down the whole service."""
    try:
        result = coro_or_none()
        if result is not None and hasattr(result, "__await__"):
            await result
    except Exception:  # noqa: BLE001 — startup must be resilient
        logger.exception("Startup step '%s' failed — continuing in degraded mode", name)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Startup / shutdown events.

    Each optional subsystem is started defensively: a failure in one (e.g. Redis
    or the vector store being unavailable) is logged and skipped rather than
    crashing the process, so core read endpoints stay available.
    """
    # Startup
    db_ok = await check_database_connection()
    redis_ok = await is_redis_available()
    print(f"✅ Database: {'connected' if db_ok else 'FAILED'}")
    print(f"✅ Redis:    {'connected' if redis_ok else 'unavailable (caching disabled)'}")

    bus = None

    async def _start_scheduler() -> None:
        from app.scheduler.scheduler import start_scheduler
        await start_scheduler()

    async def _start_event_bus() -> None:
        nonlocal bus
        from app.events.event_bus import get_event_bus
        bus = get_event_bus()
        await bus.start()
        import app.events.handlers  # noqa: F401 — triggers @subscribe decorators

    def _register_workflows() -> None:
        import app.workflows  # noqa: F401 — registers built-in workflows
        import app.workflows.workflow_scheduler  # noqa: F401 — registers event triggers

    def _register_autonomy() -> None:
        import app.autonomy  # noqa: F401 — registers built-in actions

    def _register_agents() -> None:
        import app.agents  # noqa: F401 — registers all specialized agents

    async def _start_watchdog() -> None:
        from app.self_healing.watchdog import get_watchdog
        await get_watchdog().start()

    async def _start_mcp() -> None:
        from app.mcp.server import get_mcp_server
        await get_mcp_server().start()

    def _register_graphs() -> None:
        from app.langgraph.graph import register_default_graphs
        register_default_graphs()

    await _safe_start("scheduler", _start_scheduler)          # Milestone 4
    await _safe_start("event_bus", _start_event_bus)          # Milestone 8
    await _safe_start("workflows", _register_workflows)       # Milestone 9
    await _safe_start("autonomy", _register_autonomy)         # Milestone 10
    await _safe_start("agents", _register_agents)             # Milestone 11
    await _safe_start("watchdog", _start_watchdog)            # Milestone 12
    await _safe_start("mcp_server", _start_mcp)               # Milestone 12
    await _safe_start("langgraph", _register_graphs)          # Milestone 12

    yield

    # Shutdown — each step is best-effort so shutdown always completes.
    async def _stop_watchdog() -> None:
        from app.self_healing.watchdog import get_watchdog
        await get_watchdog().stop()

    async def _stop_mcp() -> None:
        from app.mcp.server import get_mcp_server
        await get_mcp_server().stop()

    async def _stop_scheduler() -> None:
        from app.scheduler.scheduler import stop_scheduler
        await stop_scheduler()

    async def _stop_bus() -> None:
        if bus is not None:
            await bus.stop()

    async def _close_rag_engine() -> None:
        from app.rag.pg_engine import close_rag_engine
        await close_rag_engine()

    await _safe_start("watchdog.stop", _stop_watchdog)
    await _safe_start("mcp_server.stop", _stop_mcp)
    await _safe_start("scheduler.stop", _stop_scheduler)
    await _safe_start("event_bus.stop", _stop_bus)
    await _safe_start("database.close", close_database)
    await _safe_start("redis.close", close_redis)
    await _safe_start("rag_engine.close", _close_rag_engine)


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
    allow_methods=["GET", "POST", "OPTIONS"],
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
    """Catch-all handler: log the full traceback server-side, return a generic
    message to the client so stack traces are never leaked."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )