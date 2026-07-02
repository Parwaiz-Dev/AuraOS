"""Action Registry — registered autonomous actions with metadata."""

from __future__ import annotations

import logging
from typing import Any

from app.autonomy.models import ApprovalLevel, RiskLevel

logger = logging.getLogger(__name__)


class ActionDef:
    """Definition of a registered autonomous action."""

    __slots__ = ("name", "risk", "approval_level", "timeout_seconds", "rollback_capable", "description")

    def __init__(
        self,
        name: str,
        *,
        risk: str = "LOW",
        approval_level: str = "SAFE",
        timeout_seconds: float = 300.0,
        rollback_capable: bool = False,
        description: str = "",
    ) -> None:
        self.name = name
        self.risk = risk
        self.approval_level = approval_level
        self.timeout_seconds = timeout_seconds
        self.rollback_capable = rollback_capable
        self.description = description

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "risk": self.risk,
            "approval_level": self.approval_level,
            "timeout_seconds": self.timeout_seconds,
            "rollback_capable": self.rollback_capable,
            "description": self.description,
        }


_registry: dict[str, ActionDef] = {}


def register_action(action: ActionDef) -> None:
    _registry[action.name] = action
    logger.debug("Registered action: %s", action.name)


def get_action(name: str) -> ActionDef | None:
    return _registry.get(name)


def list_actions() -> list[dict[str, Any]]:
    return [a.to_dict() for a in _registry.values()]


def clear_actions() -> None:
    _registry.clear()


# ── Built-in actions ─────────────────────────────────────────────────────────

_BUILTIN_ACTIONS = [
    ActionDef("generate_forecast", risk="LOW", approval_level="SAFE", description="Generate revenue/order forecast"),
    ActionDef("generate_insight", risk="LOW", approval_level="SAFE", description="Generate daily/weekly insights"),
    ActionDef("run_workflow", risk="LOW", approval_level="SAFE", description="Execute a registered workflow"),
    ActionDef("send_email", risk="LOW", approval_level="SAFE", description="Send notification email"),
    ActionDef("send_webhook", risk="LOW", approval_level="SAFE", description="Send webhook notification"),
    ActionDef("create_report", risk="LOW", approval_level="SAFE", description="Create analytics report"),
    ActionDef("generate_recommendation", risk="LOW", approval_level="SAFE", description="Generate item recommendations"),
    ActionDef("retrain_model", risk="MEDIUM", approval_level="OWNER_APPROVAL", timeout_seconds=600.0, rollback_capable=True, description="Retrain an ML model"),
    ActionDef("modify_inventory", risk="MEDIUM", approval_level="OWNER_APPROVAL", rollback_capable=True, description="Modify inventory levels"),
    ActionDef("publish_event", risk="LOW", approval_level="SAFE", description="Publish a domain event"),
    ActionDef("revenue_recovery", risk="MEDIUM", approval_level="OWNER_APPROVAL", description="Execute revenue recovery plan"),
    ActionDef("customer_retention", risk="MEDIUM", approval_level="OWNER_APPROVAL", description="Execute customer retention plan"),
    ActionDef("delete_records", risk="CRITICAL", approval_level="ADMIN_APPROVAL", rollback_capable=False, description="Delete records (dangerous)"),
]


def _register_builtins() -> None:
    for action in _BUILTIN_ACTIONS:
        register_action(action)


_register_builtins()
