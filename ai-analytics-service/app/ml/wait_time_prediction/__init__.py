"""Wait Time Prediction ML module — XGBoost Regressor for wait time estimation."""

from app.ml.wait_time_prediction.model_manager import get_model, invalidate_cache, save_model
from app.ml.wait_time_prediction.predictor import predict_wait_time
from app.ml.wait_time_prediction.trainer import train_wait_time

__all__ = [
    "get_model",
    "invalidate_cache",
    "predict_wait_time",
    "save_model",
    "train_wait_time",
]