"""Tests for the workflow scheduler — event-driven workflow triggers."""

from __future__ import annotations

import pytest

from app.events.domain_events import (
    InsightGenerated,
    InventoryLow,
    ModelDriftDetected,
    OrderCompleted,
)
from app.events.event_bus import get_event_bus, reset_event_bus
from app.events.registry import get_registry, reset_registry
from app.workflows.workflow_engine import reset_workflow_engine
from app.workflows.workflow_registry import clear_registry as clear_wf_registry


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_event_bus()
    reset_registry()
    reset_workflow_engine()
    clear_wf_registry()


@pytest.mark.asyncio
class TestWorkflowSchedulerRegistration:
    async def test_scheduler_handlers_register(self) -> None:
        import app.workflows  # noqa: F401
        import app.workflows.workflow_scheduler  # noqa: F401

        registry = get_registry()
        all_h = registry.get_all_handlers()
        assert "OrderCompleted" in all_h
        assert "InventoryLow" in all_h
        assert "ModelDriftDetected" in all_h
        assert "InsightGenerated" in all_h

    async def test_order_completed_triggers_workflow(self) -> None:
        import app.workflows  # noqa: F401
        import app.workflows.workflow_scheduler  # noqa: F401

        bus = get_event_bus()
        await bus.start()

        event = OrderCompleted(restaurant_id="r1", order_id="o1", total_amount=100.0)
        await bus.publish(event)

        stats = bus.stats
        assert int(stats["total_published"]) >= 1

    async def test_inventory_low_triggers_workflow(self) -> None:
        import app.workflows  # noqa: F401
        import app.workflows.workflow_scheduler  # noqa: F401

        bus = get_event_bus()
        await bus.start()

        event = InventoryLow(
            restaurant_id="r1", item_id="i1", item_name="Rice",
            current_stock=2, reorder_level=10,
        )
        await bus.publish(event)

        stats = bus.stats
        assert int(stats["total_published"]) >= 1
