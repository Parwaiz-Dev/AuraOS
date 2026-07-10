"""Events router — event monitoring, history, and replay endpoints.

Milestone 8: Event-Driven Architecture.

Endpoints:
    GET  /api/v1/events          — List recent events (paginated)
    GET  /api/v1/events/stats    — Event bus statistics
    GET  /api/v1/events/failed   — Dead letter queue entries
    GET  /api/v1/events/history  — Paginated event history with filters
    POST /api/v1/events/replay   — Replay events by ID, type, restaurant, or date range
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.config.security import CurrentUser, RequireOwnerAdmin, resolve_tenant_id
from app.events.dead_letter import get_dlq
from app.events.domain_events import ALL_EVENT_TYPES
from app.events.event import BaseEvent
from app.events.event_bus import get_event_bus
from app.events.publisher import publish
from app.events.store import get_event_store
from app.schemas import (
    DeadLetterEntryResponse,
    ErrorResponse,
    EventReplayRequest,
    EventReplayResponse,
    EventResponse,
    EventStatsResponse,
    PaginatedEventResponse,
)

router = APIRouter(prefix="/events", tags=["Events"])


@router.get(
    "",
    response_model=PaginatedEventResponse,
    responses={401: {"model": ErrorResponse}},
    summary="List recent events",
)
async def list_events(
    user: CurrentUser,
    event_type: str | None = Query(default=None, description="Filter by event type"),
    restaurant_id: str | None = Query(default=None, description="Filter by restaurant ID"),
    status: str | None = Query(default=None, description="Filter by status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    store = get_event_store()
    rid = resolve_tenant_id(user, restaurant_id)
    result = await store.query(
        event_type=event_type,
        restaurant_id=rid,
        status=status,
        page=page,
        page_size=page_size,
    )
    return result


@router.get(
    "/stats",
    response_model=EventStatsResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Event bus statistics",
)
async def event_stats(user: CurrentUser) -> dict[str, Any]:
    store = get_event_store()
    stats = await store.get_stats()

    bus = get_event_bus()
    bus_stats = bus.stats

    dlq = get_dlq()
    dlq_count = await dlq.get_count()

    return {
        **stats,
        "bus_total_published": int(bus_stats.get("total_published", 0)),
        "bus_total_processed": int(bus_stats.get("total_processed", 0)),
        "bus_total_failed": int(bus_stats.get("total_failed", 0)),
        "bus_total_retries": int(bus_stats.get("total_retries", 0)),
        "dead_letter_count": dlq_count,
    }


@router.get(
    "/failed",
    response_model=list[DeadLetterEntryResponse],
    responses={401: {"model": ErrorResponse}},
    summary="Dead letter queue entries",
)
async def failed_events(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[dict[str, Any]]:
    dlq = get_dlq()
    return await dlq.get_all(limit=limit)


@router.get(
    "/history",
    response_model=PaginatedEventResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Paginated event history",
)
async def event_history(
    user: CurrentUser,
    event_type: str | None = Query(default=None),
    restaurant_id: str | None = Query(default=None),
    start_date: str | None = Query(default=None, description="ISO 8601 start"),
    end_date: str | None = Query(default=None, description="ISO 8601 end"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    store = get_event_store()
    rid = resolve_tenant_id(user, restaurant_id)
    return await store.query(
        event_type=event_type,
        restaurant_id=rid,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/replay",
    response_model=EventReplayResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Replay events",
)
async def replay_events(
    body: EventReplayRequest,
    user: RequireOwnerAdmin,
) -> dict[str, Any]:
    """Replay events by ID, type, restaurant, or date range."""
    store = get_event_store()
    replayed = 0
    failed = 0

    # Single event replay
    if body.event_id:
        event_data = await store.get(body.event_id)
        if event_data:
            event_name = event_data.get("event_name", "")
            event_cls = ALL_EVENT_TYPES.get(event_name, BaseEvent)
            try:
                event = event_cls.model_validate(event_data)
                event.status = "replaying"
                event.retry_count = 0
                await publish(event)
                replayed = 1
            except Exception:
                failed = 1
        return {"replayed": replayed, "failed": failed, "message": "Single event replay completed"}

    # DLQ replay
    if body.replay_dlq:
        dlq = get_dlq()
        replayed = await dlq.replay_all()
        return {"replayed": replayed, "failed": 0, "message": "Dead letter queue replayed"}

    # Bulk replay by filters — always scoped to the caller's own restaurant.
    result = await store.query(
        event_type=body.event_type,
        restaurant_id=resolve_tenant_id(user, body.restaurant_id),
        start_date=body.start_date,
        end_date=body.end_date,
        page=1,
        page_size=1000,
    )

    for event_data in result.get("items", []):
        event_name = event_data.get("event_name", "")
        event_cls = ALL_EVENT_TYPES.get(event_name, BaseEvent)
        try:
            event = event_cls.model_validate(event_data)
            event.status = "replaying"
            event.retry_count = 0
            await publish(event)
            replayed += 1
        except Exception:
            failed += 1

    return {
        "replayed": replayed,
        "failed": failed,
        "message": f"Replayed {replayed} events ({failed} failures)",
    }
