"""Event-Driven Architecture — Milestone 8.

Provides an async event bus with type-safe domain events, automatic handler
registration, retry support, dead-letter queue, and Redis-backed persistence.
"""

from app.events.dead_letter import DeadLetterQueue, get_dlq, reset_dlq
from app.events.domain_events import (
    ALL_EVENT_TYPES,
    CopilotConversationCompleted,
    CopilotConversationStarted,
    CustomerCreated,
    CustomerSegmentUpdated,
    DocumentUploaded,
    InsightGenerated,
    InventoryLow,
    InventoryUpdated,
    ModelDriftDetected,
    ModelRetrained,
    NotificationSent,
    OrderCompleted,
    OrderCreated,
    PaymentCompleted,
    RAGIndexed,
    RecommendationGenerated,
    ReservationCreated,
    RevenueForecastGenerated,
)
from app.events.event import BaseEvent
from app.events.event_bus import EventBus, get_event_bus, reset_event_bus
from app.events.publisher import publish, publish_and_collect
from app.events.registry import get_registry, reset_registry
from app.events.store import EventStore, get_event_store, reset_event_store
from app.events.subscriber import subscribe

__all__ = [
    # Core
    "BaseEvent",
    "EventBus",
    "EventStore",
    "DeadLetterQueue",
    "get_event_bus",
    "get_event_store",
    "get_dlq",
    "get_registry",
    "publish",
    "publish_and_collect",
    "subscribe",
    # Resets
    "reset_event_bus",
    "reset_event_store",
    "reset_dlq",
    "reset_registry",
    # Domain events
    "ALL_EVENT_TYPES",
    "OrderCreated",
    "OrderCompleted",
    "PaymentCompleted",
    "ReservationCreated",
    "CustomerCreated",
    "InventoryLow",
    "InventoryUpdated",
    "CustomerSegmentUpdated",
    "RevenueForecastGenerated",
    "RecommendationGenerated",
    "ModelRetrained",
    "ModelDriftDetected",
    "InsightGenerated",
    "NotificationSent",
    "CopilotConversationStarted",
    "CopilotConversationCompleted",
    "DocumentUploaded",
    "RAGIndexed",
]
