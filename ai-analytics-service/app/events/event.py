"""Base event model — every domain event inherits from BaseEvent."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class BaseEvent(BaseModel):
    """Strongly-typed base for all domain events.

    Subclasses add domain-specific fields; the base carries envelope
    metadata common to every event flowing through the bus.
    """

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_name: str = Field(default="")
    restaurant_id: str = Field(default="")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Processing state (set by the bus, not by publishers)
    status: str = Field(default="pending")
    processed_at: str | None = Field(default=None)
    retry_count: int = Field(default=0)

    def model_post_init(self, __context: Any) -> None:
        if not self.event_name:
            self.event_name = type(self).__name__

    def to_store_dict(self) -> dict[str, Any]:
        """Serialize for the event store (Redis)."""
        return self.model_dump(mode="json")

    @classmethod
    def from_store_dict(cls, data: dict[str, Any]) -> "BaseEvent":
        """Reconstruct from a stored dict."""
        return cls.model_validate(data)
