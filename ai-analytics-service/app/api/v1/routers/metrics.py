"""
Metrics router — aggregated model metrics.

GET /api/v1/metrics/models
    Returns total, healthy, and failed model counts plus average accuracy.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.config.security import RequireOwnerAdmin
from app.monitoring.metrics import get_metrics
from app.schemas import ModelMetricsResponse

router = APIRouter()


@router.get(
    "/metrics/models",
    response_model=ModelMetricsResponse,
    summary="Model metrics summary",
)
async def model_metrics(user: RequireOwnerAdmin) -> ModelMetricsResponse:
    """Return aggregated metrics across all ML models.

    Includes total models, healthy count, failed count, and average accuracy.
    """
    data = get_metrics()
    return ModelMetricsResponse(**data)