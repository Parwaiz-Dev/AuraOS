"""
Models router — model health inspection and manual retraining.

GET  /api/v1/models/health
    Per-model health status across all restaurants.

POST /api/v1/models/retrain
    Trigger manual retraining of a specific model.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.config.security import CurrentUser, RequireOwnerAdmin
from app.monitoring.model_health import compute_model_health
from app.scheduler.job_registry import trigger_job
from app.schemas import (
    ModelHealthItem,
    ModelHealthResponse,
    RetrainRequest,
    RetrainResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Map model names to scheduler job IDs
_MODEL_TO_JOB_ID: dict[str, str] = {
    "revenue_forecast": "revenue_forecast_training",
    "order_forecast": "order_forecast_training",
    "customer_segmentation": "customer_segmentation_training",
    "recommendation_engine": "recommendation_engine_training",
    "wait_time_prediction": "wait_time_prediction_training",
    "inventory_prediction": "inventory_prediction_training",
}


@router.get(
    "/models/health",
    response_model=ModelHealthResponse,
    summary="Model health status",
)
async def model_health(user: CurrentUser) -> ModelHealthResponse:
    """Return health status for each model type.

    A model is 'healthy' if at least one ACTIVE version exists
    for any restaurant. 'failed' if only FAILED versions exist.
    'no_model' if it has never been trained.
    """
    health_data = compute_model_health()
    models = {name: ModelHealthItem(**info) for name, info in health_data.items()}
    return ModelHealthResponse(models=models)


@router.post(
    "/models/retrain",
    response_model=RetrainResponse,
    summary="Trigger manual model retraining",
)
async def retrain_model(
    body: RetrainRequest,
    user: RequireOwnerAdmin,
) -> RetrainResponse:
    """Trigger immediate retraining of a specific model.

    The training runs asynchronously via the scheduler job system.
    Returns 'started' if the job was triggered successfully.

    Restricted to OWNER and ADMIN roles.
    """
    job_id = _MODEL_TO_JOB_ID.get(body.model)
    if job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model: {body.model}",
        )

    success = await trigger_job(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scheduler is not running or no restaurants found",
        )

    logger.info("Manual retrain triggered for model=%s by user=%s", body.model, user.id)
    return RetrainResponse(
        status="started",
        model=body.model,
        message=f"Retraining of '{body.model}' has been triggered. Check model health for status.",
    )