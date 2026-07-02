"""DeepSeek provider for the AI Copilot."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.providers import LLMProvider

if TYPE_CHECKING:
    from app.copilot.conversation_memory import ConversationMemory

logger = logging.getLogger(__name__)


class DeepSeekProvider(LLMProvider):
    """DeepSeek Chat LLM provider (OpenAI-compatible API)."""

    @property
    def name(self) -> str:
        return "deepseek"

    async def generate(self, prompt: str, *, memory: "ConversationMemory | None" = None) -> str:
        """Generate a response using the DeepSeek API (OpenAI-compatible)."""
        _ = memory  # reserved for future conversation context stitching

        api_key = settings.DEEPSEEK_API_KEY
        if not api_key:
            logger.error("DeepSeek API key is not configured")
            return "I'm sorry, the AI service is not configured. Please set DEEPSEEK_API_KEY."

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com/v1",
            )

            response = await client.chat.completions.create(
                model=settings.DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=settings.DEEPSEEK_MAX_TOKENS,
                temperature=settings.DEEPSEEK_TEMPERATURE,
            )

            content = response.choices[0].message.content
            return content.strip() if content else "I received an empty response. Please try again."

        except ImportError:
            logger.exception("openai package not installed (required for DeepSeek)")
            return "I'm sorry, the DeepSeek service is not available. Please install openai."
        except Exception:
            logger.exception("DeepSeek API call failed")
            return "I'm sorry, I encountered an error while processing your request. Please try again later."

    async def health_check(self) -> bool:
        """Check if DeepSeek is reachable."""
        if not settings.DEEPSEEK_API_KEY:
            return False
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url="https://api.deepseek.com/v1",
            )
            _ = await client.models.list()
            return True
        except Exception:
            logger.warning("DeepSeek health check failed", exc_info=True)
            return False