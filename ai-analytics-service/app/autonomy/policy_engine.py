"""Policy Engine — evaluates whether an action is allowed under current policies."""

from __future__ import annotations

import logging
from typing import Any

from app.autonomy.action_registry import get_action
from app.autonomy.exceptions import PolicyViolationError
from app.autonomy.models import ApprovalLevel

logger = logging.getLogger(__name__)

BLOCKED_ACTIONS: set[str] = set()


def evaluate_policy(action_name: str, restaurant_id: str) -> dict[str, Any]:
    """Check action against safety policies.

    Returns a dict with 'allowed', 'approval_level', and 'reason'.
    """
    if action_name in BLOCKED_ACTIONS:
        return {
            "allowed": False,
            "approval_level": "ADMIN_APPROVAL",
            "reason": f"Action '{action_name}' is blocked by policy",
        }

    action_def = get_action(action_name)
    if action_def is None:
        return {
            "allowed": False,
            "approval_level": "ADMIN_APPROVAL",
            "reason": f"Action '{action_name}' is not registered",
        }

    return {
        "allowed": True,
        "approval_level": action_def.approval_level,
        "reason": "Policy check passed",
        "risk": action_def.risk,
        "timeout_seconds": action_def.timeout_seconds,
        "rollback_capable": action_def.rollback_capable,
    }


def block_action(action_name: str) -> None:
    BLOCKED_ACTIONS.add(action_name)


def unblock_action(action_name: str) -> None:
    BLOCKED_ACTIONS.discard(action_name)


def is_auto_executable(approval_level: str) -> bool:
    return approval_level == ApprovalLevel.SAFE
