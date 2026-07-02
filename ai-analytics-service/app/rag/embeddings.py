"""Embedding Generator — creates dense vector embeddings for text chunks.

Uses sentence-transformers (all-MiniLM-L6-v2) as the default model.
Lazy-loads the model on first use.  Falls back to a mock random-vector
generator when the model is unavailable (e.g., in CI environments).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    import numpy as np

logger = logging.getLogger(__name__)

# Module-level cache — loaded once and reused
_model: "EmbeddingModel | None" = None


class EmbeddingModel:
    """Wraps a sentence-transformers model for embedding generation."""

    def __init__(self) -> None:
        self._model = None  # Lazy-loaded

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def embed(self, texts: list[str]) -> "np.ndarray":
        """Generate embeddings for a list of text strings.

        Returns a 2-D numpy array of shape (len(texts), embedding_dim).
        """
        model = self._get_model()
        if model is None:
            # Fail explicitly — never return meaningless random vectors, which would
            # silently corrupt retrieval relevance. Callers map this to HTTP 503.
            raise RuntimeError(
                "Embedding model unavailable: failed to load "
                f"'{settings.RAG_EMBEDDING_MODEL}'. Ensure sentence-transformers is "
                "installed and the model can be downloaded."
            )

        # Run in a thread to avoid blocking the event loop
        import asyncio

        return await asyncio.to_thread(self._encode_sync, model, texts)

    async def embed_single(self, text: str) -> "np.ndarray":
        """Generate an embedding for a single text string."""
        result = await self.embed([text])
        return result[0]

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_model(self):
        """Lazy-load the sentence-transformers model."""
        if self._model is not None:
            return self._model

        try:
            from sentence_transformers import SentenceTransformer

            model_name = settings.RAG_EMBEDDING_MODEL
            logger.info("Loading embedding model: %s", model_name)
            self._model = SentenceTransformer(model_name)
            logger.info("Embedding model loaded: dim=%d", self._model.get_sentence_embedding_dimension())
        except Exception:
            logger.exception("Failed to load sentence-transformers model")
            self._model = None

        return self._model

    @staticmethod
    def _encode_sync(model, texts: list[str]) -> "np.ndarray":
        """Synchronous encode (runs in a thread)."""
        return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


# ------------------------------------------------------------------
# Module-level convenience
# ------------------------------------------------------------------


def get_embedding_model() -> EmbeddingModel:
    """Return the global singleton embedding model (lazy init)."""
    global _model
    if _model is None:
        _model = EmbeddingModel()
    return _model