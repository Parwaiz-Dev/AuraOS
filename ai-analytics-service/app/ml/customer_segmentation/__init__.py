"""Customer Segmentation ML module — KMeans + RFM clustering."""

from app.ml.customer_segmentation.model_manager import get_model, invalidate_cache, save_model
from app.ml.customer_segmentation.predictor import predict_segments
from app.ml.customer_segmentation.trainer import train_customer_segmentation

__all__ = [
    "get_model",
    "invalidate_cache",
    "predict_segments",
    "save_model",
    "train_customer_segmentation",
]