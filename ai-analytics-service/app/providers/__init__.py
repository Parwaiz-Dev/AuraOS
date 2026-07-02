"""AI Copilot — LLM provider abstraction and factory."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from app.config.settings import settings

if TYPE_CHECKING:
    from app.copilot.conversation_memory import ConversationMemory

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base for LLM providers (Gemini, OpenAI, DeepSeek, Mock)."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the provider name (e.g., 'gemini', 'openai')."""
        ...

    @abstractmethod
    async def generate(self, prompt: str, *, memory: "ConversationMemory | None" = None) -> str:
        """Send a prompt to the LLM and return the generated text."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable and configured."""
        ...


def get_provider() -> LLMProvider:
    """Return the configured LLM provider based on settings.COPILOT_PROVIDER."""
    provider_name = settings.COPILOT_PROVIDER.lower()

    if provider_name == "gemini":
        from app.providers.gemini_provider import GeminiProvider
        return GeminiProvider()

    if provider_name == "openai":
        from app.providers.openai_provider import OpenAIProvider
        return OpenAIProvider()

    if provider_name == "deepseek":
        from app.providers.deepseek_provider import DeepSeekProvider
        return DeepSeekProvider()

    if provider_name == "mock":
        from app.providers.mock_provider import MockProvider
        return MockProvider()

    logger.warning("Unknown provider '%s', falling back to mock", provider_name)
    from app.providers.mock_provider import MockProvider
    return MockProvider()