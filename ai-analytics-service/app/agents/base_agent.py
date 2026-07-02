"""Base agent — shared behavior for all domain agents.

Each domain agent:
1. opens its OWN short-lived read-only DB session (so agents can run concurrently
   without sharing the request-scoped session — same pattern as the schedulers in
   app.scheduler.cron_jobs),
2. calls one or more tools (which wrap existing services),
3. optionally synthesizes a natural-language answer via the existing LLM provider
   abstraction (app.providers.get_provider).

Agents return a plain, JSON-serializable dict so they slot directly into the
LangGraph state without a checkpointer.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from typing import Any

from app.config.settings import settings

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base for all domain agents."""

    #: Stable, human-readable agent name used in agents_used / metrics.
    name: str = "BaseAgent"
    #: Short domain label (revenue, inventory, ...).
    domain: str = "base"

    @abstractmethod
    async def gather(self, db: Any, restaurant_id: str, query: str) -> dict[str, Any]:
        """Call tools and return structured data for this domain.

        Implementations should be defensive — return partial data rather than
        raising, so one agent's failure does not abort the whole graph.
        """
        ...

    def _prompt(self, query: str, data: dict[str, Any]) -> str:
        """Build the per-agent synthesis prompt. Overridable by subclasses."""
        import json

        return (
            f"You are the {self.name} for a restaurant analytics platform. "
            f"Answer the user's question using ONLY the structured data below. "
            f"Be concise and specific; cite numbers where available. "
            f"If the data is empty, say you don't have enough data.\n\n"
            f"## Question\n{query}\n\n"
            f"## {self.domain.title()} Data\n{json.dumps(data, default=str)[:4000]}\n\n"
            f"## Answer"
        )

    async def synthesize(self, query: str, data: dict[str, Any]) -> str:
        """Produce a natural-language answer for this agent's data.

        Reuses the existing provider abstraction. Returns a safe fallback string
        on any provider failure (never raises).
        """
        if not settings.AGENTS_SYNTHESIS_ENABLED:
            return ""
        try:
            from app.providers import get_provider

            provider = get_provider()
            return await provider.generate(self._prompt(query, data), memory=None)
        except Exception:
            logger.debug("%s: synthesis failed", self.name, exc_info=True)
            return ""

    async def run(self, db: Any, restaurant_id: str, query: str) -> dict[str, Any]:
        """Full agent step: gather data, then synthesize prose.

        Returns ``{"agent", "domain", "data", "answer", "error"}``.
        """
        error: str | None = None
        data: dict[str, Any] = {}
        try:
            data = await self.gather(db, restaurant_id, query)
        except Exception as exc:  # defensive — keep the graph alive
            logger.warning("%s: gather failed: %s", self.name, exc)
            error = str(exc)

        answer = await self.synthesize(query, data) if not error else ""

        return {
            "agent": self.name,
            "domain": self.domain,
            "data": data,
            "answer": answer,
            "error": error,
        }


@asynccontextmanager
async def agent_session():
    """Yield a dedicated read-only DB session for an agent.

    Mirrors app.config.database.get_db (SET TRANSACTION READ ONLY) but as a
    standalone context manager so each concurrently-running agent gets its own
    session instead of sharing the request-scoped one.
    """
    from sqlalchemy import text

    from app.config.database import _async_session_factory

    async with _async_session_factory() as session:
        try:
            await session.execute(text("SET TRANSACTION READ ONLY"))
            yield session
        finally:
            await session.close()


# ── Milestone 11: Specialized Agent base ─────────────────────────────────────


class SpecializedAgent(ABC):
    """Base for Milestone 11 multi-agent system agents.

    Each specialized agent owns a single domain and communicates only
    through the event bus and shared memory — never calling other agents
    directly.
    """

    agent_id: str = "base"
    name: str = "BaseSpecializedAgent"
    description: str = ""
    capabilities: list[str] = []
    supported_events: list[str] = []
    priority: int = 5

    def __init__(self) -> None:
        self.status: str = "IDLE"
        self._tasks_completed: int = 0
        self._tasks_failed: int = 0
        self._avg_response_ms: float = 0.0
        self._restart_count: int = 0

    @abstractmethod
    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        """Execute the agent's primary task."""
        ...

    async def handle_message(self, message: Any) -> dict[str, Any]:
        """Handle an inter-agent message."""
        return await self.process(message.payload if hasattr(message, "payload") else {})

    def get_info(self) -> Any:
        from app.agents.models import AgentInfo
        return AgentInfo(
            agent_id=self.agent_id,
            name=self.name,
            description=self.description,
            capabilities=self.capabilities,
            supported_events=self.supported_events,
            priority=self.priority,
            status=self.status,
            health="healthy" if self.status != "FAILED" else "unhealthy",
            tasks_completed=self._tasks_completed,
            tasks_failed=self._tasks_failed,
            avg_response_ms=self._avg_response_ms,
            restart_count=self._restart_count,
        )

    def restart(self) -> None:
        self.status = "IDLE"
        self._restart_count += 1
        logger.info("Agent %s restarted (count=%d)", self.agent_id, self._restart_count)
