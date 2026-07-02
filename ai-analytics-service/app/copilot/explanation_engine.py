"""Explanation Engine — extracts reasons, trends, and actionable recommendations.

Parses the LLM response to identify structured insights:
- reasons: Why something happened
- trends: Directional patterns
- recommendations: Actionable suggestions
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def extract_explanation(answer: str) -> dict[str, Any]:
    """Extract structured explanation components from the LLM answer.

    Returns a dict with:
    - reasons: list of cause-effect explanations
    - trends: list of directional patterns detected
    - recommendations: list of actionable suggestions
    - summary: a one-line summary of the answer
    """
    return {
        "reasons": _extract_reasons(answer),
        "trends": _extract_trends(answer),
        "recommendations": _extract_recommendations(answer),
        "summary": _extract_summary(answer),
    }


def _extract_reasons(answer: str) -> list[str]:
    """Extract cause-effect explanations from the answer."""
    reasons: list[str] = []

    # Patterns that indicate causal explanations
    cause_patterns = [
        r"(?:because|due to|driven by|caused by|result of|attributed to)\s+(.+?)(?:\.|$)",
        r"(?:the\s+(?:decline|increase|drop|rise|growth)\s+(?:is|was)\s+(.+?)(?:\.|$))",
    ]

    for pattern in cause_patterns:
        matches = re.findall(pattern, answer, re.IGNORECASE)
        for match in matches:
            clean = match.strip().rstrip(".")
            if clean and len(clean) > 10:
                reasons.append(clean)

    return reasons[:3]


def _extract_trends(answer: str) -> list[str]:
    """Extract directional trend statements from the answer."""
    trends: list[str] = []

    trend_patterns = [
        r"(?:trend\s+is\s+(.+?)(?:\.|$))",
        r"(?:(upward|downward|stable|declining|growing|improving|increasing|decreasing)\s+trend)",
        r"(?:(\d+%)\s+(?:increase|decrease|growth|decline))",
    ]

    for pattern in trend_patterns:
        matches = re.findall(pattern, answer, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = " ".join(m for m in match if m)
            clean = str(match).strip().rstrip(".")
            if clean and len(clean) > 3:
                trends.append(clean)

    # Deduplicate
    seen: set[str] = set()
    unique: list[str] = []
    for t in trends:
        lower = t.lower()
        if lower not in seen:
            seen.add(lower)
            unique.append(t)

    return unique[:3]


def _extract_recommendations(answer: str) -> list[str]:
    """Extract actionable recommendations from the answer."""
    recommendations: list[str] = []

    rec_patterns = [
        r"(?:recommend(?:ation)?:?\s+(.+?)(?:\.|$))",
        r"(?:consider\s+(.+?)(?:\.|$))",
        r"(?:suggestion:?\s+(.+?)(?:\.|$))",
        r"(?:try\s+(.+?)(?:\.|$))",
        r"(?:(?:should|could)\s+(.+?)(?:\.|$))",
    ]

    for pattern in rec_patterns:
        matches = re.findall(pattern, answer, re.IGNORECASE)
        for match in matches:
            clean = str(match).strip().rstrip(".")
            if clean and len(clean) > 10 and "?" not in clean:
                recommendations.append(clean)

    return recommendations[:3]


def _extract_summary(answer: str) -> str:
    """Extract or generate a one-line summary of the answer."""
    # Take the first meaningful sentence
    sentences = re.split(r"(?<=[.!?])\s+", answer)
    for sentence in sentences:
        clean = sentence.strip()
        if clean and len(clean) > 20:
            # Truncate if too long
            if len(clean) > 150:
                return clean[:147] + "..."
            return clean

    # Fallback
    return answer[:150] if len(answer) > 150 else answer