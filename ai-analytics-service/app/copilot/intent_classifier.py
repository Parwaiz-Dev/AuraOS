"""Intent Classifier — detects the user's intent from natural language questions.

Classifies messages into one of: REVENUE, CUSTOMERS, FORECAST, INVENTORY,
OPERATIONS, MENU, RECOMMENDATIONS, GENERAL.
"""

from __future__ import annotations

import re
from enum import Enum


class Intent(str, Enum):
    REVENUE = "REVENUE"
    CUSTOMERS = "CUSTOMERS"
    FORECAST = "FORECAST"
    INVENTORY = "INVENTORY"
    OPERATIONS = "OPERATIONS"
    MENU = "MENU"
    RECOMMENDATIONS = "RECOMMENDATIONS"
    GENERAL = "GENERAL"


# Weighted keyword rules for intent classification.
# Each rule maps intent → list of (keyword_pattern, weight).
_INTENT_RULES: dict[Intent, list[tuple[re.Pattern, int]]] = {
    Intent.REVENUE: [
        (re.compile(r"\brevenue\b", re.IGNORECASE), 5),
        (re.compile(r"\bsales?\b", re.IGNORECASE), 4),
        (re.compile(r"\bearnings?\b", re.IGNORECASE), 4),
        (re.compile(r"\bincome\b", re.IGNORECASE), 3),
        (re.compile(r"\bgrowth\b", re.IGNORECASE), 2),
        (re.compile(r"\bcompare\s+this\s+week\b", re.IGNORECASE), 5),
        (re.compile(r"\bwhich\s+day\s+performed\b", re.IGNORECASE), 5),
        (re.compile(r"\bwhy\s+(is\s+)?revenue\b", re.IGNORECASE), 6),
        (re.compile(r"\bdown\b", re.IGNORECASE), 1),
    ],
    Intent.CUSTOMERS: [
        (re.compile(r"\bcustomers?\b", re.IGNORECASE), 5),
        (re.compile(r"\bVIP\b", re.IGNORECASE), 6),
        (re.compile(r"\bchurn\b", re.IGNORECASE), 6),
        (re.compile(r"\bloyal\b", re.IGNORECASE), 4),
        (re.compile(r"\bwho\s+are\s+my\b", re.IGNORECASE), 3),
        (re.compile(r"\bsegment\b", re.IGNORECASE), 4),
        (re.compile(r"\bretention\b", re.IGNORECASE), 3),
    ],
    Intent.FORECAST: [
        (re.compile(r"\bforecast\b", re.IGNORECASE), 6),
        (re.compile(r"\bpredict\b", re.IGNORECASE), 5),
        (re.compile(r"\bnext\s+week\b", re.IGNORECASE), 4),
        (re.compile(r"\bnext\s+month\b", re.IGNORECASE), 4),
        (re.compile(r"\bupcoming\b", re.IGNORECASE), 3),
        (re.compile(r"\bfuture\b", re.IGNORECASE), 2),
        (re.compile(r"\b30\s*days?\b", re.IGNORECASE), 4),
        (re.compile(r"\btrend\b", re.IGNORECASE), 2),
    ],
    Intent.INVENTORY: [
        (re.compile(r"\binventory\b", re.IGNORECASE), 6),
        (re.compile(r"\bstock\b", re.IGNORECASE), 5),
        (re.compile(r"\brestock\b", re.IGNORECASE), 6),
        (re.compile(r"\bwaste\b", re.IGNORECASE), 4),
        (re.compile(r"\bwhich\s+items?\s+need\b", re.IGNORECASE), 5),
        (re.compile(r"\brunning\s+low\b", re.IGNORECASE), 4),
        (re.compile(r"\bat\s+risk\b", re.IGNORECASE), 3),
        (re.compile(r"\bdepletion\b", re.IGNORECASE), 4),
    ],
    Intent.OPERATIONS: [
        (re.compile(r"\bpeak\s+hour\b", re.IGNORECASE), 6),
        (re.compile(r"\bwait\s+time\b", re.IGNORECASE), 6),
        (re.compile(r"\bkitchen\b", re.IGNORECASE), 4),
        (re.compile(r"\btable\b", re.IGNORECASE), 3),
        (re.compile(r"\boccupancy\b", re.IGNORECASE), 4),
        (re.compile(r"\bhow\s+(long|busy)\b", re.IGNORECASE), 3),
        (re.compile(r"\bexpected\b", re.IGNORECASE), 2),
    ],
    Intent.MENU: [
        (re.compile(r"\bmenu\b", re.IGNORECASE), 5),
        (re.compile(r"\bitems?\b", re.IGNORECASE), 3),
        (re.compile(r"\bcategory\b", re.IGNORECASE), 4),
        (re.compile(r"\bwhich\s+(item|category)\s+performs?\b", re.IGNORECASE), 5),
        (re.compile(r"\bpromote\b", re.IGNORECASE), 5),
        (re.compile(r"\bbest\s+performing\b", re.IGNORECASE), 5),
        (re.compile(r"\btop\s+selling\b", re.IGNORECASE), 5),
    ],
    Intent.RECOMMENDATIONS: [
        (re.compile(r"\brecommend\b", re.IGNORECASE), 5),
        (re.compile(r"\bsuggest\b", re.IGNORECASE), 3),
        (re.compile(r"\bcommonly\s+bought\b", re.IGNORECASE), 6),
        (re.compile(r"\bfrequently\s+bought\b", re.IGNORECASE), 6),
        (re.compile(r"\bwhich\s+products?\b", re.IGNORECASE), 3),
        (re.compile(r"\bcombo\b", re.IGNORECASE), 3),
        (re.compile(r"\bpair\b", re.IGNORECASE), 2),
    ],
}


def classify_intent(message: str) -> Intent:
    """Classify the user's message into a single intent.

    Uses weighted keyword matching. The intent with the highest cumulative
    weight wins. Falls back to GENERAL if no keywords match.
    """
    scores: dict[Intent, int] = {intent: 0 for intent in Intent}

    for intent, rules in _INTENT_RULES.items():
        for pattern, weight in rules:
            if pattern.search(message):
                scores[intent] += weight

    # Find the intent with the highest score
    best_intent = max(scores, key=lambda k: scores[k])

    if scores[best_intent] == 0:
        return Intent.GENERAL

    return best_intent


def classify_intents(message: str, top_n: int = 3) -> list[tuple[Intent, int]]:
    """Return the top-N intents with their scores, sorted by score descending."""
    scores: dict[Intent, int] = {intent: 0 for intent in Intent}

    for intent, rules in _INTENT_RULES.items():
        for pattern, weight in rules:
            if pattern.search(message):
                scores[intent] += weight

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(intent, score) for intent, score in ranked if score > 0][:top_n]