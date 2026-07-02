"""Tests for domain event creation, serialization, and validation."""

from __future__ import annotations

import pytest

from app.events.domain_events import (
    ALL_EVENT_TYPES,
    CopilotConversationCompleted,
    CopilotConversationStarted,
    CustomerCreated,
    DocumentUploaded,
    InsightGenerated,
    InventoryLow,
    ModelDriftDetected,
    ModelRetrained,
    NotificationSent,
    OrderCompleted,
    OrderCreated,
    PaymentCompleted,
    RAGIndexed,
    RecommendationGenerated,
    RevenueForecastGenerated,
)
from app.events.event import BaseEvent


class TestBaseEvent:
    def test_base_event_defaults(self) -> None:
        event = BaseEvent()
        assert event.event_id
        assert event.event_name == "BaseEvent"
        assert event.status == "pending"
        assert event.retry_count == 0
        assert event.restaurant_id == ""
        assert event.timestamp

    def test_base_event_auto_name(self) -> None:
        event = OrderCreated(restaurant_id="r1")
        assert event.event_name == "OrderCreated"

    def test_base_event_serialization(self) -> None:
        event = OrderCompleted(
            restaurant_id="r1",
            order_id="o1",
            total_amount=123.45,
            completed_at="2025-01-01T12:00:00Z",
        )
        data = event.to_store_dict()
        assert data["event_name"] == "OrderCompleted"
        assert data["order_id"] == "o1"
        assert data["total_amount"] == 123.45
        assert data["restaurant_id"] == "r1"

    def test_base_event_from_store_dict(self) -> None:
        event = InsightGenerated(
            restaurant_id="r1",
            anomaly_count=3,
            trend_count=2,
        )
        data = event.to_store_dict()
        restored = InsightGenerated.from_store_dict(data)
        assert restored.event_id == event.event_id
        assert restored.anomaly_count == 3


class TestDomainEvents:
    def test_all_event_types_registered(self) -> None:
        assert len(ALL_EVENT_TYPES) == 18

    def test_order_created(self) -> None:
        e = OrderCreated(restaurant_id="r1", order_id="o1", order_type="DINE_IN", total_amount=99.0)
        assert e.event_name == "OrderCreated"
        assert e.order_type == "DINE_IN"

    def test_payment_completed(self) -> None:
        e = PaymentCompleted(payment_id="p1", order_id="o1", restaurant_id="r1", amount=50.0, method="UPI")
        assert e.method == "UPI"

    def test_inventory_low(self) -> None:
        e = InventoryLow(restaurant_id="r1", item_id="i1", item_name="Rice", current_stock=2, reorder_level=10)
        assert e.current_stock == 2
        assert e.reorder_level == 10

    def test_model_retrained(self) -> None:
        e = ModelRetrained(model_name="revenue_forecast", restaurant_id="r1", version="v3", metrics={"mape": 0.05})
        assert e.model_name == "revenue_forecast"
        assert e.metrics["mape"] == 0.05

    def test_model_drift_detected(self) -> None:
        e = ModelDriftDetected(model_name="revenue_forecast", restaurant_id="r1", issues=["MAPE exceeded"])
        assert len(e.issues) == 1

    def test_insight_generated(self) -> None:
        e = InsightGenerated(restaurant_id="r1", anomaly_count=1, trend_count=2, opportunity_count=3, risk_count=0)
        assert e.anomaly_count == 1
        assert e.risk_count == 0

    def test_copilot_events(self) -> None:
        started = CopilotConversationStarted(restaurant_id="r1", message="What is my revenue?", intent="REVENUE")
        assert started.intent == "REVENUE"

        completed = CopilotConversationCompleted(
            restaurant_id="r1", intent="REVENUE", provider="mock", response_time_ms=150.0, confidence=0.85,
        )
        assert completed.confidence == 0.85

    def test_document_uploaded(self) -> None:
        e = DocumentUploaded(restaurant_id="r1", document_id="d1", filename="menu.pdf", chunks=12)
        assert e.chunks == 12

    def test_rag_indexed(self) -> None:
        e = RAGIndexed(restaurant_id="r1", document_id="d1", chunk_count=10)
        assert e.chunk_count == 10

    def test_notification_sent(self) -> None:
        e = NotificationSent(restaurant_id="r1", channel="email", alert_count=3, success=True)
        assert e.success is True

    def test_customer_created(self) -> None:
        e = CustomerCreated(customer_id="c1", restaurant_id="r1", name="John", phone="+91123")
        assert e.name == "John"

    def test_recommendation_generated(self) -> None:
        e = RecommendationGenerated(restaurant_id="r1", item_count=5)
        assert e.item_count == 5

    def test_revenue_forecast_generated(self) -> None:
        e = RevenueForecastGenerated(restaurant_id="r1", forecast_days=30, confidence=0.92)
        assert e.forecast_days == 30

    @pytest.mark.parametrize("event_name", list(ALL_EVENT_TYPES.keys()))
    def test_all_events_can_be_instantiated(self, event_name: str) -> None:
        cls = ALL_EVENT_TYPES[event_name]
        event = cls(restaurant_id="test-restaurant")
        assert event.event_name == event_name
        assert event.restaurant_id == "test-restaurant"

    @pytest.mark.parametrize("event_name", list(ALL_EVENT_TYPES.keys()))
    def test_all_events_roundtrip_serialization(self, event_name: str) -> None:
        cls = ALL_EVENT_TYPES[event_name]
        event = cls(restaurant_id="r1")
        data = event.to_store_dict()
        restored = cls.model_validate(data)
        assert restored.event_id == event.event_id
        assert restored.event_name == event_name
