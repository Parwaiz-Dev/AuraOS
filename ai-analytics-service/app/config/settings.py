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

    # ── Milestone 4: Model Registry ─────────────────────────────────────────
    MODEL_REGISTRY_DIR: str = "./model_registry"
    """Directory for model metadata JSON files (version history, metrics)."""

    MODEL_RETENTION_VERSIONS: int = 3
    """Number of latest versions to keep per model; older versions are archived."""

    # ── Milestone 4: Drift Detection ────────────────────────────────────────
    DRIFT_MAPE_THRESHOLD: float = 0.20
    """Mean Absolute Percentage Error threshold before flagging drift (>20%)."""

    DRIFT_RMSE_MULTIPLIER: float = 2.0
    """RMSE multiplier vs baseline — if RMSE exceeds baseline * multiplier, flag drift."""

    DRIFT_VARIANCE_THRESHOLD: float = 0.30
    """Prediction variance threshold — if variance increases >30%, flag drift."""

    # ── Milestone 4: Scheduler ──────────────────────────────────────────────
    SCHEDULER_ENABLED: bool = True
    """Enable APScheduler background jobs. Disable for testing."""

    SCHEDULER_TIMEZONE: str = "Asia/Kolkata"
    """Timezone for scheduled training jobs."""

    # ── Milestone 5: AI Copilot ─────────────────────────────────────────────
    COPILOT_PROVIDER: str = "gemini"
    """LLM provider: gemini | openai | deepseek | mock."""

    COPILOT_MEMORY_TTL: int = 3600
    """Conversation memory TTL in Redis (seconds). 1 hour default."""

    COPILOT_MAX_HISTORY: int = 10
    """Maximum conversation exchanges to retain per restaurant."""

    COPILOT_CONFIDENCE_THRESHOLD: float = 0.5
    """Minimum confidence before returning a fallback response."""

    # ── Gemini ──────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-pro-exp-03-25"
    GEMINI_MAX_TOKENS: int = 1024
    GEMINI_TEMPERATURE: float = 0.3

    # ── OpenAI ──────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_MAX_TOKENS: int = 1024
    OPENAI_TEMPERATURE: float = 0.3

    # ── DeepSeek ────────────────────────────────────────────────────────────
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_MAX_TOKENS: int = 1024
    DEEPSEEK_TEMPERATURE: float = 0.3


    # ── Milestone 6: Proactive Insights ───────────────────────────────────────
    INSIGHTS_DAILY_CRON_HOUR: int = 8
    """Hour of day (IST) to run daily insight generation."""

    INSIGHTS_WEEKLY_CRON_DAY: int = 1
    """Day of week (Monday=1) to run weekly insight report."""

    INSIGHTS_WEEKLY_CRON_HOUR: int = 9
    """Hour of day (IST) to run weekly insight report."""

    INSIGHTS_HISTORY_MAX: int = 500
    """Maximum number of insight history entries to retain."""

    # ── Anomaly Detection ─────────────────────────────────────────────────────
    ANOMALY_CONTAMINATION: float = 0.05
    """Isolation Forest contamination parameter (expected % of anomalies)."""

    ANOMALY_ENABLED: bool = True
    """Enable anomaly detection in insight generation."""

    # ── Notification Thresholds ───────────────────────────────────────────────
    NOTIFY_REVENUE_DROP_PCT: float = 15.0
    """Percentage revenue drop that triggers a notification."""

    NOTIFY_WAIT_TIME_THRESHOLD_MINUTES: float = 45.0
    """Wait time (minutes) that triggers a notification."""

    NOTIFY_INVENTORY_RISK_DAYS: int = 3
    """Days until depletion that triggers inventory risk notification."""

    NOTIFY_ENABLED: bool = False
    """Enable notification delivery (email, webhook)."""

    # ── Email Notifications ───────────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "AuraOS Insights <insights@auraos.com>"

    # ── Webhook Notifications ─────────────────────────────────────────────────
    WEBHOOK_URL: str = ""
    WEBHOOK_SECRET: str = ""


    # ── Milestone 7: RAG (Retrieval-Augmented Generation) ───────────────────────
    RAG_ENABLED: bool = True
    """Enable RAG features (document upload, search, Q&A)."""

    RAG_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    """Sentence-transformers model for generating embeddings."""

    RAG_CHUNK_SIZE: int = 500
    """Token count per chunk for document splitting."""

    RAG_CHUNK_OVERLAP: int = 100
    """Token overlap between consecutive chunks."""

    RAG_TOP_K: int = 5
    """Default number of chunks to retrieve per query."""

    RAG_VECTOR_DB: str = "in_memory"
    """Vector database backend: in_memory | qdrant | pgvector."""

    RAG_QDRANT_URL: str = "http://localhost:6333"
    """Qdrant server URL."""

    RAG_QDRANT_API_KEY: str = ""
    """Qdrant API key (leave empty for local dev)."""

    RAG_QDRANT_COLLECTION: str = "auraos_rag"
    """Qdrant collection name for RAG chunk vectors."""

    RAG_PGVECTOR_URL: str = ""
    """Writable async PostgreSQL URL for the pgvector backend.

    Used ONLY by PgVectorStore for the dedicated rag_embeddings table — never for
    business tables. Falls back to DATABASE_URL when empty. This connection is NOT
    opened read-only, unlike the get_db() business session.
    """

    RAG_EMBEDDING_DIM: int = 384
    """Embedding vector dimensionality (all-MiniLM-L6-v2 = 384)."""

    RAG_CACHE_TTL: int = 300
    """Cache TTL in seconds for RAG search results."""

    RAG_MAX_CONVERSATION_HISTORY: int = 10
    """Maximum conversation exchanges to retain per restaurant for RAG."""

    RAG_OBSERVABILITY_ENABLED: bool = True
    """Track retrieval latency, token usage, query count, hit rate."""


    # ── Milestone 8: Multi-Agent System (LangGraph) ─────────────────────────────
    AGENTS_ENABLED: bool = True
    """Enable the LangGraph multi-agent system. When False (or on failure),
    /agents/chat falls back to the Milestone 5 single-agent Copilot flow."""

    AGENTS_MAX_HISTORY: int = 20
    """Maximum conversation exchanges to retain per restaurant for the agent system."""

    AGENTS_MEMORY_TTL: int = 3600
    """Agent conversation memory TTL in Redis (seconds)."""

    AGENTS_MAX_PARALLEL: int = 6
    """Maximum number of domain agents activated for a single 'mixed' query."""

    AGENTS_SYNTHESIS_ENABLED: bool = True
    """If True, each domain agent calls the LLM to synthesize prose from its tool
    results. If False, agents return structured data only (faster, no LLM cost)."""


    # ── Milestone 8: Event-Driven Architecture ─────────────────────────────────
    EVENTS_ENABLED: bool = True
    """Enable the event bus. When False, publish() is a no-op."""

    EVENTS_MAX_RETRIES: int = 3
    """Maximum retry attempts per handler before moving to the dead-letter queue."""

    EVENTS_RETRY_DELAY_SECONDS: float = 1.0
    """Base delay (seconds) for exponential back-off between retries."""

    EVENTS_STORE_TTL_SECONDS: int = 604800
    """TTL for event store entries in Redis (7 days)."""

    EVENTS_DLQ_MAX_SIZE: int = 1000
    """Maximum entries in the dead-letter queue."""

    EVENTS_STORE_ENABLED: bool = True
    """Enable event persistence to Redis. When False, events are fire-and-forget."""


    # ── Milestone 9: AI Workflow Orchestration ─────────────────────────────────
    WORKFLOWS_ENABLED: bool = True
    """Enable the workflow orchestration engine."""

    WORKFLOWS_DEFAULT_TIMEOUT: float = 600.0
    """Default timeout (seconds) for workflow execution."""

    WORKFLOWS_MAX_RETRIES: int = 2
    """Default max retries per workflow step."""

    WORKFLOWS_STORE_TTL_SECONDS: int = 604800
    """TTL for workflow execution records in Redis (7 days)."""


    # ── Milestone 10: Fully Autonomous AI Restaurant OS ────────────────────────
    AUTONOMY_ENABLED: bool = True
    """Enable the autonomous AI engine."""

    AUTONOMY_CONFIDENCE_THRESHOLD: float = 0.6
    """Minimum confidence score to act on an observation."""

    AUTONOMY_HISTORY_MAX: int = 1000
    """Maximum autonomy history entries retained."""


    # ── Milestone 11: Multi-Agent AI System ────────────────────────────────────
    AGENTS_SYSTEM_ENABLED: bool = True
    """Enable the multi-agent coordinator and specialized agents."""

    AGENTS_TASK_TIMEOUT: float = 60.0
    """Default timeout (seconds) per agent subtask."""

    AGENTS_MESSAGE_TIMEOUT: float = 30.0
    """Default timeout (seconds) for inter-agent messages."""

    AGENTS_MESSAGE_RETRIES: int = 2
    """Default retry count for inter-agent message delivery."""


    # ── Milestone 12: Self-Healing AI Platform ────────────────────────────────
    SELF_HEALING_ENABLED: bool = True
    """Enable the self-healing watchdog and automatic recovery."""

    WATCHDOG_INTERVAL: float = 30.0
    """Watchdog health check interval in seconds."""

    CIRCUIT_BREAKER_THRESHOLD: int = 5
    """Default failure threshold before opening a circuit breaker."""

    CIRCUIT_BREAKER_TIMEOUT: float = 60.0
    """Default circuit breaker reset timeout in seconds."""

    RECOVERY_MAX_RESTARTS: int = 5
    """Maximum restarts per component within the restart window."""

    ANOMALY_Z_THRESHOLD: float = 2.5
    """Z-score threshold for anomaly detection."""


    # ── Milestone 12: MCP (Model Context Protocol) ────────────────────────────
    MCP_ENABLED: bool = True
    """Enable the MCP server and tool registry."""

    MCP_MAX_TOOL_TIMEOUT: float = 60.0
    """Maximum tool execution timeout in seconds."""


    # ── Milestone 12: LangGraph Orchestration ─────────────────────────────────
    LANGGRAPH_ENABLED: bool = True
    """Enable LangGraph-based graph orchestration."""

    GRAPH_DEFAULT_TIMEOUT: float = 300.0
    """Default timeout for graph execution in seconds."""

    GRAPH_MAX_ITERATIONS: int = 50
    """Maximum iterations (loop guard) for graph execution."""


# Singleton
settings = Settings()