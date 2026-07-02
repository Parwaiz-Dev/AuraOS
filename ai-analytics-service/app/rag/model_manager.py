"""Model Manager — manages the LLM provider lifecycle for RAG.

Uses the existing LLM provider abstraction (app/providers) to generate
answers from retrieved context.  Supports Gemini (default), OpenAI,
DeepSeek, and Mock providers.

Also tracks embedding model health and provider stats for observability.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    from app.rag.retriever import RetrievalResult

logger = logging.getLogger(__name__)


@dataclass
class RAGAnswer:
    """A generated answer from the RAG pipeline."""

    answer: str
    provider: str
    token_usage: int
    latency_ms: float
    sources: list = field(default_factory=list)


class ModelManager:
    """Manages LLM provider for RAG answer generation.

    Delegates to the existing provider abstraction (app/providers)
    for actual LLM calls, adding RAG-specific prompt construction.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_answer(
        self,
        question: str,
        context: str,
        conversation_history: str | None = None,
    ) -> RAGAnswer:
        """Generate an answer using retrieved context.

        Args:
            question: The user's question.
            context: Retrieved document context (from citation builder).
            conversation_history: Optional formatted conversation history.

        Returns:
            RAGAnswer with the generated answer, provider name, token usage, and latency.
        """
        t0 = time.perf_counter()

        prompt = self._build_prompt(question, context, conversation_history)

        try:
            from app.providers import get_provider

            provider = get_provider()
            response = await provider.generate(prompt, memory=None)
            provider_name = provider.name
        except Exception:
            logger.exception("LLM generation failed, using fallback")
            response = self._fallback_answer(question, context)
            provider_name = "fallback"

        elapsed = (time.perf_counter() - t0) * 1000

        # Approximate token count (rough estimate: 1 token ≈ 4 chars)
        token_usage = len(prompt) // 4 + len(response) // 4

        return RAGAnswer(
            answer=response,
            provider=provider_name,
            token_usage=token_usage,
            latency_ms=round(elapsed, 2),
        )

    async def health_check(self) -> bool:
        """Check if the configured LLM provider is healthy."""
        try:
            from app.providers import get_provider

            provider = get_provider()
            return await provider.health_check()
        except Exception:
            logger.exception("Provider health check failed")
            return False

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(
        question: str,
        context: str,
        conversation_history: str | None = None,
    ) -> str:
        """Build a RAG prompt with context and instructions."""
        parts: list[str] = []

        parts.append(
            "You are an AI assistant for a restaurant analytics platform. "
            "Answer the user's question using ONLY the provided context below. "
            "If the context does not contain enough information to answer, "
            "say so clearly. Do not make up information."
        )

        if conversation_history:
            parts.append(f"\n## Conversation History\n{conversation_history}")

        parts.append(f"\n## Context Documents\n{context}")

        parts.append(f"\n## Question\n{question}")

        parts.append(
            "\n## Answer\n"
            "Provide a clear, concise answer based on the context above. "
            "Cite specific sources when possible."
        )

        return "\n".join(parts)

    @staticmethod
    def _fallback_answer(question: str, context: str) -> str:
        """Generate a simple fallback answer when the LLM is unavailable."""
        if not context or context == "No relevant documents found.":
            return (
                "I'm unable to generate a response at this time because no relevant "
                "documents were found and the AI provider is unavailable. Please try "
                "uploading relevant documents or check back later."
            )

        # Extract the first source text as a simple answer
        lines = context.split("\n")
        first_source = next((line for line in lines if line.startswith("[Source:")), "")
        return (
            f"I found relevant information but the AI provider is currently unavailable. "
            f"Here is the most relevant source: {first_source}"
        )


# ------------------------------------------------------------------
# Module-level convenience
# ------------------------------------------------------------------

_model_manager: ModelManager | None = None


def get_model_manager() -> ModelManager:
    """Return the global singleton model manager."""
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager