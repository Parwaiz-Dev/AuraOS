"""Copilot Service — orchestrates the full AI Copilot pipeline.

Flow:
1. Classify user intent
2. Build analytics context
3. Load conversation memory
4. Build the prompt
5. Call the LLM provider
6. Format and return the response
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from app.config.redis_client import cache_get, cache_set, is_redis_available
from app.config.settings import settings
from app.copilot import (
    Intent,
    build_context,
    build_prompt,
    classify_intent,
    extract_explanation,
    format_response,
    get_memory,
)
from app.providers import get_provider

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Stats tracker — Redis-backed with an in-memory fallback (graceful degradation).
_STATS_KEY = "copilot:stats:global"

_stats: dict[str, int | float] = {
    "questions_answered": 0,
    "total_response_time_ms": 0.0,
}


async def _load_stats() -> dict[str, int | float]:
    """Load copilot stats from Redis, falling back to the in-memory copy."""
    try:
        if await is_redis_available():
            stored = await cache_get(_STATS_KEY)
            if isinstance(stored, dict):
                _stats.update(stored)
    except Exception:
        logger.debug("Failed to load copilot stats from Redis", exc_info=True)
    return _stats


async def _save_stats() -> None:
    """Persist copilot stats to Redis (best-effort, long-lived)."""
    try:
        if await is_redis_available():
            await cache_set(_STATS_KEY, dict(_stats), ttl=10 * 365 * 24 * 3600)
    except Exception:
        logger.debug("Failed to persist copilot stats to Redis", exc_info=True)


async def process_chat(
    db: "AsyncSession",
    restaurant_id: str,
    message: str,
) -> dict:
    """Process a natural language chat message and return a structured response.

    Args:
        db: Read-only database session.
        restaurant_id: The authenticated restaurant's UUID.
        message: The user's natural language question.

    Returns:
        A dict with keys: answer, sources, confidence, explanation, intent, provider.
    """
    start_time = time.monotonic()

    # Milestone 8: Publish conversation started event
    from app.events.publisher import publish as _publish_event
    from app.events.domain_events import CopilotConversationStarted

    await _publish_event(CopilotConversationStarted(
        restaurant_id=restaurant_id,
        message=message[:200],
    ))

    # 1. Classify intent
    intent = classify_intent(message)
    logger.info("Copilot intent=%s for restaurant=%s", intent.value, restaurant_id)

    # 2. Build analytics context
    context = await build_context(db, restaurant_id, message)

    # 3. Load conversation memory
    memory = await get_memory(restaurant_id)
    history = memory.get_formatted_history()

    # 4. Build the prompt
    prompt = build_prompt(message, context, conversation_history=history, intent=intent)

    # 5. Call the LLM provider
    provider = get_provider()
    raw_answer = await provider.generate(prompt, memory=memory)

    # 6. Format the response
    response = format_response(raw_answer)

    # 7. Extract explanation
    explanation = extract_explanation(response["answer"])

    # 8. Update conversation memory
    await memory.add_exchange("user", message)
    await memory.add_exchange("assistant", response["answer"])

    # 9. Update stats
    elapsed_ms = (time.monotonic() - start_time) * 1000
    await _load_stats()
    _stats["questions_answered"] = int(_stats.get("questions_answered", 0)) + 1
    _stats["total_response_time_ms"] = float(_stats.get("total_response_time_ms", 0.0)) + elapsed_ms
    await _save_stats()

    # 10. Check confidence threshold
    if response["confidence"] < settings.COPILOT_CONFIDENCE_THRESHOLD:
        logger.warning(
            "Low confidence response (%.2f) for message: %s",
            response["confidence"],
            message[:100],
        )

    # Milestone 8: Publish conversation completed event
    from app.events.domain_events import CopilotConversationCompleted

    await _publish_event(CopilotConversationCompleted(
        restaurant_id=restaurant_id,
        intent=intent.value,
        provider=provider.name,
        response_time_ms=round(elapsed_ms, 2),
        confidence=response.get("confidence", 0.0),
    ))

    return {
        **response,
        "explanation": explanation,
        "intent": intent.value,
        "provider": provider.name,
        "response_time_ms": round(elapsed_ms, 2),
    }


async def get_copilot_stats() -> dict:
    """Return copilot usage statistics (Redis-backed, in-memory fallback)."""
    await _load_stats()
    questions = int(_stats.get("questions_answered", 0))
    total_ms = float(_stats.get("total_response_time_ms", 0.0))
    avg_response_time = round(total_ms / questions, 2) if questions > 0 else 0.0

    provider = get_provider()

    return {
        "questionsAnswered": questions,
        "averageResponseTime": avg_response_time,
        "provider": provider.name,
    }