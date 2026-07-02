"""Response Formatter — parse and sanitize LLM outputs into structured API responses."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def format_response(raw_text: str) -> dict[str, Any]:
    """Format raw LLM output into a structured API response.

    Extracts:
    - answer: The main response text
    - sources: Any data sources referenced (empty list for now)
    - confidence: Estimated confidence score
    """
    answer = _sanitize(raw_text)

    return {
        "answer": answer,
        "sources": [],
        "confidence": _estimate_confidence(answer),
    }


def _sanitize(text: str) -> str:
    """Sanitize the LLM output: strip markdown fences, trim whitespace."""
    # Remove code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())

    # Remove any "Answer:" prefix the model might add
    text = re.sub(r"^Answer:\s*", "", text.strip())

    return text.strip()


def _estimate_confidence(answer: str) -> float:
    """Estimate confidence based on response characteristics.

    Heuristic: longer, more specific answers with numbers are higher confidence.
    Apologetic or uncertain language lowers confidence.
    """
    score = 0.5  # baseline

    # Longer answers suggest more confidence
    if len(answer) > 200:
        score += 0.15
    elif len(answer) > 100:
        score += 0.10
    elif len(answer) < 30:
        score -= 0.15

    # Specific numbers suggest data-backed answers
    if re.search(r"[₹$]\s*[\d,]+", answer):
        score += 0.10
    if re.search(r"\d+%", answer):
        score += 0.05

    # Uncertainty language lowers confidence
    uncertainty_patterns = [
        r"sorry",
        r"i don't know",
        r"i'm not sure",
        r"cannot (?:answer|help|provide)",
        r"no data",
        r"not available",
        r"unable to",
    ]
    for pattern in uncertainty_patterns:
        if re.search(pattern, answer, re.IGNORECASE):
            score -= 0.15
            break

    return round(max(0.0, min(1.0, score)), 2)


def parse_json_response(raw_text: str) -> dict[str, Any]:
    """Attempt to parse JSON from an LLM response. Falls back to text."""
    try:
        # Try to find JSON block
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            return json.loads(json_match.group(0))
    except (json.JSONDecodeError, ValueError):
        logger.debug("Failed to parse JSON from response, using text fallback")

    return format_response(raw_text)