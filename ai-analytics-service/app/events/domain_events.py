"""Domain events — strongly typed events for the AuraOS analytics platform."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.events.event import BaseEvent


# ── Business Domain ──────────────────────────────────────────────────────────


class OrderCreated(BaseEvent):
    order_id: str = ""
    order_type: str = ""
    total_amount: float = 0.0


class OrderCompleted(BaseEvent):
    order_id: str = ""
    total_amount: float = 0.0
    completed_at: str = ""


class PaymentCompleted(BaseEvent):
    payment_id: str = ""
    order_id: str = ""
    amount: float = 0.0
    method: str = ""


class ReservationCreated(BaseEvent):
    reservation_id: str = ""
    customer_id: str = ""
    date: str = ""


class CustomerCreated(BaseEvent):
    customer_id: str = ""
    name: str = ""
    phone: str = ""


# ── Inventory ────────────────────────────────────────────────────────────────


class InventoryLow(BaseEvent):
    item_id: str = ""
    item_name: str = ""
    current_stock: int = 0
    reorder_level: int = 0


class InventoryUpdated(BaseEvent):
    item_id: str = ""
    quantity_before: int = 0
    quantity_after: int = 0


# ── ML / Analytics ───────────────────────────────────────────────────────────


class CustomerSegmentUpdated(BaseEvent):
    segment_counts: dict[str, int] = Field(default_factory=dict)


class RevenueForecastGenerated(BaseEvent):
    forecast_days: int = 0
    confidence: float = 0.0


class RecommendationGenerated(BaseEvent):
    item_count: int = 0


class ModelRetrained(BaseEvent):
    model_name: str = ""
    version: str = ""
    metrics: dict[str, Any] = Field(default_factory=dict)


class ModelDriftDetected(BaseEvent):
    model_name: str = ""
    issues: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


# ── Insights & Notifications ─────────────────────────────────────────────────


class InsightGenerated(BaseEvent):
    anomaly_count: int = 0
    trend_count: int = 0
    opportunity_count: int = 0
    risk_count: int = 0


class NotificationSent(BaseEvent):
    channel: str = ""
    alert_count: int = 0
    success: bool = True


# ── AI Copilot ───────────────────────────────────────────────────────────────


class CopilotConversationStarted(BaseEvent):
    message: str = ""
    intent: str = ""


class CopilotConversationCompleted(BaseEvent):
    intent: str = ""
    provider: str = ""
    response_time_ms: float = 0.0
    confidence: float = 0.0


# ── RAG ──────────────────────────────────────────────────────────────────────


class DocumentUploaded(BaseEvent):
    document_id: str = ""
    filename: str = ""
    chunks: int = 0


class RAGIndexed(BaseEvent):
    document_id: str = ""
    chunk_count: int = 0


# ── Registry of all event types for lookup by name ───────────────────────────

ALL_EVENT_TYPES: dict[str, type[BaseEvent]] = {
    cls.__name__: cls
    for cls in [
        OrderCreated,
        OrderCompleted,
        PaymentCompleted,
        ReservationCreated,
        CustomerCreated,
        InventoryLow,
        InventoryUpdated,
        CustomerSegmentUpdated,
        RevenueForecastGenerated,
        RecommendationGenerated,
        ModelRetrained,
        ModelDriftDetected,
        InsightGenerated,
        NotificationSent,
        CopilotConversationStarted,
        CopilotConversationCompleted,
        DocumentUploaded,
        RAGIndexed,
    ]
}
