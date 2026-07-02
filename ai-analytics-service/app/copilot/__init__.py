"""AI Copilot — natural language business intelligence for restaurant owners.

Submodules:
- intent_classifier: Detects user intent (REVENUE, CUSTOMERS, FORECAST, etc.)
- context_builder:   Gathers analytics data for prompt context
- prompt_templates:  Builds structured LLM prompts
- response_formatter: Parses and sanitizes LLM outputs
- conversation_memory: Redis-backed per-restaurant conversation history
- explanation_engine: Extracts reasons, trends, and recommendations
"""

from __future__ import annotations

from app.copilot.intent_classifier import Intent, classify_intent, classify_intents
from app.copilot.context_builder import build_context
from app.copilot.prompt_templates import build_prompt, build_simple_prompt
from app.copilot.response_formatter import format_response
from app.copilot.conversation_memory import ConversationMemory, get_memory
from app.copilot.explanation_engine import extract_explanation

__all__ = [
    "Intent",
    "classify_intent",
    "classify_intents",
    "build_context",
    "build_prompt",
    "build_simple_prompt",
    "format_response",
    "ConversationMemory",
    "get_memory",
    "extract_explanation",
]