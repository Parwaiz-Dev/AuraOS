"""Pytest configuration and shared fixtures for the AI Analytics service."""

from __future__ import annotations

import sys
from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# ── Windows event-loop policy fix (required for asyncpg + SQLAlchemy async) ──
if sys.platform == "win32":
    import asyncio

    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# ── Session-scoped event loop (keeps SQLAlchemy engine pool alive) ───────────


@pytest.fixture(scope="session")
def event_loop() -> Any:
    """Session-scoped event loop — prevents "different loop" errors.

    SQLAlchemy's async engine is a module-level singleton.  Without a
    session-scoped loop, pytest-asyncio creates a new loop per test,
    invalidating the engine pool after the first test.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Import the FastAPI app instance
from app.main import app  # noqa: E402


# ── HTTP client ─────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client that talks directly to the FastAPI app (no network)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Auth helpers ────────────────────────────────────────────────────────────────


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Return a minimal set of auth headers with a valid-looking JWT.

    The token is signed with the settings.JWT_SECRET so it passes validation.
    """
    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone

    from app.config.settings import settings

    token = pyjwt.encode(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": "test@auraos.com",
            "role": "ADMIN",
            "restaurantId": "00000000-0000-0000-0000-000000000002",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def expired_token() -> str:
    """Return an expired JWT for testing 401 handling."""
    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone

    from app.config.settings import settings

    return pyjwt.encode(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": "expired@auraos.com",
            "role": "WAITER",
            "restaurantId": "00000000-0000-0000-0000-000000000002",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def _role_token(role: str) -> str:
    """Build a valid JWT carrying an arbitrary role (for RBAC tests)."""
    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone

    from app.config.settings import settings

    return pyjwt.encode(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": f"{role.lower()}@auraos.com",
            "role": role,
            "restaurantId": "00000000-0000-0000-0000-000000000002",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


@pytest.fixture
def waiter_headers() -> dict[str, str]:
    """Auth headers for a non-privileged WAITER role (should be forbidden on RBAC routes)."""
    return {"Authorization": f"Bearer {_role_token('WAITER')}"}


@pytest.fixture
def owner_headers() -> dict[str, str]:
    """Auth headers for an OWNER role (privileged)."""
    return {"Authorization": f"Bearer {_role_token('OWNER')}"}


# ── Deterministic embedding model (no sentence-transformers dependency) ──────────


@pytest.fixture(autouse=True)
def _fake_embedding_model(request, monkeypatch) -> None:
    """Replace the embedding model with a deterministic hash-based encoder.

    The real silent random fallback was removed (embed() now raises when the
    sentence-transformers model is unavailable). To keep RAG pipeline tests
    hermetic and independent of model downloads, we inject a deterministic
    encoder so retrieval is stable and reproducible.

    Skipped for test_embeddings.py, which tests the real embed()/failure contract.
    """
    if request.node.fspath.basename == "test_embeddings.py":
        return

    import hashlib

    import numpy as np

    from app.config.settings import settings
    from app.rag import embeddings as emb

    dim = settings.RAG_EMBEDDING_DIM

    def _encode(texts: list[str]) -> np.ndarray:
        vecs = []
        for t in texts:
            seed = int.from_bytes(hashlib.sha256(t.encode()).digest()[:4], "big")
            rng = np.random.default_rng(seed=seed)
            v = rng.random(dim, dtype=np.float32)
            vecs.append(v / (np.linalg.norm(v) + 1e-10))
        return np.array(vecs, dtype=np.float32)

    async def _embed(self, texts: list[str]) -> np.ndarray:  # noqa: ANN001
        return _encode(texts)

    async def _embed_single(self, text: str) -> np.ndarray:  # noqa: ANN001
        return _encode([text])[0]

    monkeypatch.setattr(emb.EmbeddingModel, "embed", _embed, raising=True)
    monkeypatch.setattr(emb.EmbeddingModel, "embed_single", _embed_single, raising=True)


# ── Reset RAG singletons between tests (prevent cross-test state leakage) ─────────


@pytest_asyncio.fixture(autouse=True)
async def _reset_rag_state(request) -> AsyncGenerator[None, None]:
    """Reset the in-memory vector store and knowledge base around each test.

    The vector store and knowledge base are module-level singletons. Without a
    reset, documents uploaded by one test leak into the next (e.g. an "empty
    store" assertion fails because a prior test populated it).
    """
    if request.node.fspath.basename == "test_embeddings.py":
        yield
        return

    from app.rag.knowledge_base import reset_knowledge_base
    from app.rag.vector_store import reset_vector_store

    async def _reset() -> None:
        # Reset the cached ingestion service first: it captures kb/store references
        # at construction, so it must be rebuilt after the singletons are reset.
        import app.rag.ingestion_service as ingestion_mod

        ingestion_mod._ingestion = None
        await reset_vector_store()
        await reset_knowledge_base()

    await _reset()
    yield
    await _reset()


# ── Reset event bus between tests ─────────────────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def _reset_event_state() -> AsyncGenerator[None, None]:
    """Reset the event bus, store, DLQ, and handler registry between tests."""
    from app.events.dead_letter import reset_dlq
    from app.events.event_bus import reset_event_bus
    from app.events.registry import reset_registry
    from app.events.store import reset_event_store

    reset_event_bus()
    reset_event_store()
    reset_dlq()
    reset_registry()
    yield
    reset_event_bus()
    reset_event_store()
    reset_dlq()
    reset_registry()


# ── Reset workflow engine between tests ───────────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def _reset_workflow_state() -> AsyncGenerator[None, None]:
    """Reset the workflow engine between tests."""
    from app.workflows.workflow_engine import reset_workflow_engine

    reset_workflow_engine()
    yield
    reset_workflow_engine()


# ── Reset autonomy engine between tests ───────────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def _reset_autonomy_state() -> AsyncGenerator[None, None]:
    """Reset the autonomy engine between tests."""
    from app.autonomy.approval_engine import reset_approvals
    from app.autonomy.autonomous_engine import reset_autonomous_engine
    from app.autonomy.decision_engine import reset_decision_engine

    reset_autonomous_engine()
    reset_decision_engine()
    reset_approvals()
    yield
    reset_autonomous_engine()
    reset_decision_engine()
    reset_approvals()


# ── Reset agent system between tests ──────────────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def _reset_agent_state() -> AsyncGenerator[None, None]:
    """Reset the multi-agent system between tests."""
    from app.agents.coordinator import reset_coordinator
    from app.agents.memory import reset_memory
    from app.agents.messaging import reset_messaging
    from app.agents.task_manager import reset_tasks

    reset_coordinator()
    reset_messaging()
    reset_tasks()
    yield
    reset_coordinator()
    reset_messaging()
    reset_tasks()


# ── Reset Milestone 12 state between tests ──────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def _reset_m12_state() -> AsyncGenerator[None, None]:
    """Reset self-healing, MCP, and LangGraph singletons between tests."""
    from app.self_healing.circuit_breaker import reset_circuit_breakers
    from app.self_healing.health_monitor import reset_health_monitor
    from app.self_healing.metrics import reset_metrics_collector
    from app.self_healing.recovery_engine import reset_recovery_engine

    from app.mcp.registry import reset_mcp_registry

    from app.langgraph.graph import reset_graph_registry
    from app.langgraph.graph_executor import reset_graph_executor
    from app.langgraph.graph_memory import reset_graph_memory

    reset_circuit_breakers()
    reset_metrics_collector()
    reset_health_monitor()
    reset_recovery_engine()
    reset_mcp_registry()
    reset_graph_executor()
    reset_graph_memory()
    reset_graph_registry()
    yield
    reset_circuit_breakers()
    reset_metrics_collector()
    reset_health_monitor()
    reset_recovery_engine()
    reset_mcp_registry()
    reset_graph_executor()
    reset_graph_memory()
    reset_graph_registry()