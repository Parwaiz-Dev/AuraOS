"""
Centralised configuration for the AI Analytics service.

All settings are sourced from environment variables or a .env file.
This module is the single source of truth — every other module imports
from here rather than reading os.environ directly.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Server ──────────────────────────────────────────────────────────────
    APP_NAME: str = "AuraOS AI Analytics"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Database (read-only!) ───────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://auraos_user:auraos_password@localhost:5433/auraos"
    )
    # Sync URL for Alembic migrations (uses psycopg2 or falls back to sync pg)
    DATABASE_URL_SYNC: str = (
        "postgresql://auraos_user:auraos_password@localhost:5433/auraos"
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False  # set True to log SQL

    # ── Redis ───────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL_SECONDS: int = 300  # 5 minutes default

    # ── JWT (must match AuraOS Core API secrets) ────────────────────────────
    JWT_SECRET: str = "your_jwt_secret_here_min_32_chars_change_production_12345"
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "auraos-core"

    # ── Celery ──────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── ML ──────────────────────────────────────────────────────────────────
    MODELS_DIR: str = "./models"
    TRAINING_SCHEDULE: str = "daily"  # hourly | daily | weekly


# Singleton
settings = Settings()