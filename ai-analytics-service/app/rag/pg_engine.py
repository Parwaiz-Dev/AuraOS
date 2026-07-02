"""Dedicated writable async engine for the RAG pgvector backend.

This engine is intentionally separate from app.config.database (which serves
read-only business-table sessions via ``SET TRANSACTION READ ONLY``). The RAG
store needs to WRITE to its own ``rag_embeddings`` table, so it cannot use the
read-only session factory.

Safety boundary:
    - This engine is used ONLY by PgVectorStore for the rag_embeddings table.
    - It NEVER touches AuraOS business tables.
    - The business read-only guarantee in app.config.database is unaffected.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config.settings import settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _rag_database_url() -> str:
    """Return the writable URL for RAG persistence (falls back to DATABASE_URL)."""
    return settings.RAG_PGVECTOR_URL or settings.DATABASE_URL


def get_rag_engine() -> AsyncEngine:
    """Return the writable async engine for RAG persistence, creating it lazily."""
    global _engine, _session_factory
    if _engine is None:
        _engine = create_async_engine(
            _rag_database_url(),
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            echo=settings.DB_ECHO,
            pool_pre_ping=True,
        )
        _session_factory = async_sessionmaker(
            _engine, class_=AsyncSession, expire_on_commit=False
        )
    return _engine


@asynccontextmanager
async def get_rag_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a writable session bound to the RAG engine.

    Unlike app.config.database.get_db(), this does NOT set the transaction
    read-only — the RAG store writes to its own rag_embeddings table.
    """
    if _session_factory is None:
        get_rag_engine()
    assert _session_factory is not None
    async with _session_factory() as session:
        yield session


async def close_rag_engine() -> None:
    """Dispose the RAG engine pool (called on shutdown / in tests)."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
