"""Step: Retrain ML models."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class RetrainModelsStep(WorkflowStep):
    name = "retrain_models"
    timeout_seconds = 300.0
    retries = 1

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        model_name = ctx.metadata.get("model_name", "revenue_forecast")

        task_map = {
            "revenue_forecast": "app.tasks.revenue_training_task",
            "order_forecast": "app.tasks.order_training_task",
            "customer_segmentation": "app.tasks.segmentation_training_task",
            "recommendation_engine": "app.tasks.recommendation_training_task",
            "wait_time_prediction": "app.tasks.wait_time_training_task",
            "inventory_prediction": "app.tasks.inventory_training_task",
        }

        module_name = task_map.get(model_name)
        if not module_name:
            return {"retrained": False, "reason": f"Unknown model: {model_name}"}

        import importlib
        mod = importlib.import_module(module_name)
        func_name = f"run_{model_name.replace('_prediction', '').replace('_engine', '').replace('_forecast', '')}_training"
        # Normalise function names
        func_map = {
            "revenue_forecast": "run_revenue_training",
            "order_forecast": "run_order_training",
            "customer_segmentation": "run_segmentation_training",
            "recommendation_engine": "run_recommendation_training",
            "wait_time_prediction": "run_wait_time_training",
            "inventory_prediction": "run_inventory_training",
        }
        func = getattr(mod, func_map[model_name])
        await func(ctx.restaurant_id)

        logger.info("Model %s retrained for restaurant=%s", model_name, ctx.restaurant_id)
        return {"retrained": True, "model_name": model_name}
