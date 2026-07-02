"""Confidence scoring for autonomous decisions."""

from __future__ import annotations

from app.autonomy.models import Observation


def compute_confidence(observation: Observation) -> float:
    """Compute a confidence score (0.0–1.0) for acting on an observation.

    Higher deviation and severity yield higher confidence that action is needed.
    """
    deviation = abs(observation.deviation_pct)

    if deviation > 50:
        base = 0.95
    elif deviation > 30:
        base = 0.85
    elif deviation > 15:
        base = 0.70
    elif deviation > 5:
        base = 0.50
    else:
        base = 0.30

    severity_boost = {
        "critical": 0.10,
        "high": 0.05,
        "medium": 0.0,
        "low": -0.05,
    }.get(observation.severity, 0.0)

    return min(1.0, max(0.0, round(base + severity_boost, 2)))


def meets_threshold(confidence: float, threshold: float = 0.6) -> bool:
    return confidence >= threshold
