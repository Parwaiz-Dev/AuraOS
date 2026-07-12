"""Gemini LLM provider for the AI Copilot."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from app.config.settings import settings
from app.providers import LLMProvider

if TYPE_CHECKING:
    from app.copilot.conversation_memory import ConversationMemory

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    """Google Gemini LLM provider."""

    @property
    def name(self) -> str:
        return "gemini"

    async def generate(self, prompt: str, *, memory: "ConversationMemory | None" = None) -> str:
        """Generate a response using the Gemini API.

        The google-generativeai client is synchronous, so we run the blocking
        call in a thread to avoid stalling the asyncio event loop.
        """
        _ = memory  # reserved for future conversation context stitching

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.error("Gemini API key is not configured")
            return "I'm sorry, the AI service is not configured. Please set GEMINI_API_KEY."

        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)

            model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                generation_config={
                    "max_output_tokens": settings.GEMINI_MAX_TOKENS,
                    "temperature": settings.GEMINI_TEMPERATURE,
                },
            )

            # Run synchronous Gemini call in a thread to avoid blocking the event loop
            response = await asyncio.to_thread(model.generate_content, prompt)
            return response.text.strip()

        except ImportError:
            logger.exception("google-generativeai package not installed")
            return "I'm sorry, the Gemini AI service is not available. Please install google-generativeai."
        except Exception:
            logger.exception("Gemini API call failed")
            return "I'm sorry, I encountered an error while processing your request. Please try again later."

    async def health_check(self) -> bool:
        """Check if Gemini is reachable."""
        if not settings.GEMINI_API_KEY:
            return False
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            await asyncio.to_thread(genai.list_models)
            return True
        except Exception:
            logger.warning("Gemini health check failed", exc_info=True)
            return False