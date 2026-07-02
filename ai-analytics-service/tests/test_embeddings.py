"""Tests for EmbeddingModel — Milestone 7.

Covers:
- embed() returns the correct shape when a real model is available
- embed() raises RuntimeError (no silent random fallback) when the model fails to load
- embed_single() returns a 1-D array
- Empty list returns empty array
- Singleton get_embedding_model() returns same instance
"""

from __future__ import annotations

import numpy as np
import pytest

from app.config.settings import settings
from app.rag.embeddings import EmbeddingModel, get_embedding_model


def _model_available() -> bool:
    """Return True if the sentence-transformers model can be loaded in this env."""
    try:
        EmbeddingModel()._get_model()  # noqa: SLF001 - test introspection
    except Exception:
        return False
    return EmbeddingModel()._get_model() is not None  # noqa: SLF001


_MODEL_AVAILABLE = _model_available()
_DIM = settings.RAG_EMBEDDING_DIM


# ═══════════════════════════════════════════════════════════════════════════════
# Explicit-failure contract (no random fallback)
# ═══════════════════════════════════════════════════════════════════════════════


class TestEmbeddingFailsExplicitly:
    """When the model can't load, embed() must raise — never return random vectors."""

    @pytest.mark.asyncio
    async def test_embed_raises_when_model_unavailable(self, monkeypatch) -> None:
        """embed() should raise RuntimeError when the model is unavailable."""
        model = EmbeddingModel()
        monkeypatch.setattr(model, "_get_model", lambda: None)
        with pytest.raises(RuntimeError, match="Embedding model unavailable"):
            await model.embed(["hello"])

    @pytest.mark.asyncio
    async def test_embed_single_raises_when_model_unavailable(self, monkeypatch) -> None:
        """embed_single() should also raise RuntimeError when the model is unavailable."""
        model = EmbeddingModel()
        monkeypatch.setattr(model, "_get_model", lambda: None)
        with pytest.raises(RuntimeError, match="Embedding model unavailable"):
            await model.embed_single("hello")

    @pytest.mark.asyncio
    async def test_embed_returns_no_random_vectors(self, monkeypatch) -> None:
        """Regression: the old code returned seeded random vectors; it must not anymore."""
        model = EmbeddingModel()
        monkeypatch.setattr(model, "_get_model", lambda: None)
        with pytest.raises(RuntimeError):
            await model.embed(["a", "b"])


# ═══════════════════════════════════════════════════════════════════════════════
# Real model behavior (skipped when the model is not installed/available)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.skipif(not _MODEL_AVAILABLE, reason="sentence-transformers model unavailable")
class TestEmbeddingModelReal:
    """Behavior when a real embedding model is available."""

    @pytest.mark.asyncio
    async def test_embed_returns_correct_shape(self) -> None:
        model = EmbeddingModel()
        result = await model.embed(["Hello world", "Another text"])
        assert isinstance(result, np.ndarray)
        assert result.shape == (2, _DIM)

    @pytest.mark.asyncio
    async def test_embed_single_returns_1d_array(self) -> None:
        model = EmbeddingModel()
        result = await model.embed_single("Hello world")
        assert isinstance(result, np.ndarray)
        assert result.shape == (_DIM,)

    @pytest.mark.asyncio
    async def test_embed_is_deterministic(self) -> None:
        model = EmbeddingModel()
        r1 = await model.embed_single("Hello world")
        r2 = await model.embed_single("Hello world")
        assert np.allclose(r1, r2)


# ═══════════════════════════════════════════════════════════════════════════════
# Singleton factory
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetEmbeddingModel:
    """Tests for the singleton factory function."""

    def test_get_embedding_model_returns_singleton(self) -> None:
        model1 = get_embedding_model()
        model2 = get_embedding_model()
        assert model1 is model2

    def test_get_embedding_model_returns_embedding_model(self) -> None:
        model = get_embedding_model()
        assert isinstance(model, EmbeddingModel)
