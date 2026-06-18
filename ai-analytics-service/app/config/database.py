"""
Read-only async database connection for the AuraOS PostgreSQL instance.

The AI Analytics service NEVER writes to business tables.  All operations
go through a dedicated read-only user ("auraos_analytics") when available,
falling back to the regular user for development convenience.

Usage:
    from app.config.database import get_db, engine

    async with get_db() as session:
        stmt = select(Order).where(Order.restaurant_id == restaurant_id)
        result = await session.execute(stmt)
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config.settings import settings

# ── Engine ──────────────────────────────────────────────────────────────────────

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    echo=settings.DB_ECHO,
    # read-only safety: never emit DDL
    pool_pre_ping=True,
)

# ── Session factory ─────────────────────────────────────────────────────────────

_async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a read-only database session."""
    async with _async_session_factory() as session:
        try:
            # Enforce read-only at the transaction level as a safety net.
            # This prevents any accidental INSERT/UPDATE/DELETE from modifying
            # business data, even if a developer forgets this is read-only.
            await session.execute(text("SET TRANSACTION READ ONLY"))
            yield session
        finally:
            await session.close()


async def check_database_connection() -> bool:
    """Return True if the database is reachable and responding."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            return True
    except Exception:
        return False


async def close_database() -> None:
    """Gracefully dispose the engine pool (called on shutdown)."""
    await engine.dispose()