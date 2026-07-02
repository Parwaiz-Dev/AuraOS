"""OpenAI GPT provider for the AI Copilot."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.providers import LLMProvider

if TYPE_CHECKING:
    from app.copilot.conversation_memory import ConversationMemory

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """OpenAI GPT-4o LLM provider."""

    @property
    def name(self) -> str:
        return "openai"

    async def generate(self, prompt: str, *, memory: "ConversationMemory | None" = None) -> str:
        """Generate a response using the OpenAI chat completions API."""
        _ = memory  # reserved for future conversation context stitching

        api_key = settings.OPENAI_API_KEY
        if not api_key:
            logger.error("OpenAI API key is not configured")
            return "I'm sorry, the AI service is not configured. Please set OPENAI_API_KEY."

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key)

            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE,
            )

            content = response.choices[0].message.content
            return content.strip() if content else "I received an empty response. Please try again."

        except ImportError:
            logger.exception("openai package not installed")
            return "I'm sorry, the OpenAI service is not available. Please install openai."
        except Exception:
            logger.exception("OpenAI API call failed")
            return "I'm sorry, I encountered an error while processing your request. Please try again later."

    async def health_check(self) -> bool:
        """Check if OpenAI is reachable."""
        if not settings.OPENAI_API_KEY:
            return False
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            _ = await client.models.list()
            return True
        except Exception:
            logger.warning("OpenAI health check failed", exc_info=True)
            return False