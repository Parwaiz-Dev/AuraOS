"""Recommendation Engine ML module — association rules / co-occurrence analysis."""

from app.ml.recommendation_engine.model_manager import get_model, invalidate_cache, save_model
from app.ml.recommendation_engine.predictor import predict_recommendations
from app.ml.recommendation_engine.trainer import train_recommendations

__all__ = [
    "get_model",
    "invalidate_cache",
    "predict_recommendations",
    "save_model",
    "train_recommendations",
]