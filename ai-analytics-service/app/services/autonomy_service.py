"""Autonomy Service — service layer for the autonomous AI engine."""

from __future__ import annotations

import logging
from typing import Any

from app.autonomy.approval_engine import (
    approve as _approve,
    get_approval_history,
    get_pending,
    reject as _reject,
)
from app.autonomy.autonomous_engine import get_autonomous_engine
from app.autonomy.models import Observation

logger = logging.getLogger(__name__)


async def get_status() -> dict[str, Any]:
    engine = get_autonomous_engine()
    return await engine.get_status()


async def get_actions() -> list[dict[str, Any]]:
    from app.autonomy.action_registry import list_actions
    return list_actions()


async def get_history(limit: int = 50) -> list[dict[str, Any]]:
    engine = get_autonomous_engine()
    return await engine.get_history(limit=limit)


async def get_pending_approvals(restaurant_id: str | None = None) -> list[dict[str, Any]]:
    return await get_pending(restaurant_id=restaurant_id)


async def approve_action(request_id: str, resolved_by: str = "") -> dict[str, Any] | None:
    result = await _approve(request_id, resolved_by=resolved_by)
    if result is None:
        return None
    return result.model_dump(mode="json")


async def reject_action(request_id: str, resolved_by: str = "") -> dict[str, Any] | None:
    result = await _reject(request_id, resolved_by=resolved_by)
    if result is None:
        return None
    return result.model_dump(mode="json")


async def run_autonomous_action(
    action_name: str,
    restaurant_id: str,
    user_id: str = "",
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    engine = get_autonomous_engine()
    return await engine.run_action(
        action_name=action_name,
        restaurant_id=restaurant_id,
        user_id=user_id,
        parameters=parameters,
    )


async def process_observation(
    observation: Observation,
    restaurant_id: str,
    user_id: str = "",
) -> dict[str, Any]:
    engine = get_autonomous_engine()
    return await engine.process_observation(
        observation=observation,
        restaurant_id=restaurant_id,
        user_id=user_id,
    )
