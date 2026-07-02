"""Event handlers package — import all handlers for auto-registration.

Importing this module triggers the ``@subscribe`` decorators in each
handler file, which registers them with the global handler registry.
"""

from app.events.handlers import (
    analytics_handler,
    audit_handler,
    forecast_handler,
    insight_handler,
    inventory_handler,
    model_registry_handler,
    notification_handler,
    recommendation_handler,
)

__all__ = [
    "analytics_handler",
    "audit_handler",
    "forecast_handler",
    "insight_handler",
    "inventory_handler",
    "model_registry_handler",
    "notification_handler",
    "recommendation_handler",
]
