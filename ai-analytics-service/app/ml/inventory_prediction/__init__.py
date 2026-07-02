"""Inventory Prediction ML module — depletion date and reorder recommendations."""

from app.ml.inventory_prediction.model_manager import get_model, invalidate_cache, save_model
from app.ml.inventory_prediction.predictor import predict_inventory
from app.ml.inventory_prediction.trainer import train_inventory_prediction

__all__ = [
    "get_model",
    "invalidate_cache",
    "predict_inventory",
    "save_model",
    "train_inventory_prediction",
]