"""Approval Engine — manages approval requests for autonomous actions."""

from __future__ import annotations

import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.autonomy.models import ApprovalRequest
from app.config.settings import settings

logger = logging.getLogger(__name__)

_PENDING_KEY = "autonomy:approvals:pending"
_HISTORY_KEY = "autonomy:approvals:history"
_pending: deque[ApprovalRequest] = deque(maxlen=500)
_history: deque[ApprovalRequest] = deque(maxlen=1000)


async def create_approval(
    restaurant_id: str,
    action_name: str,
    decision_id: str,
    plan_id: str,
    approval_level: str,
    reason: str = "",
    parameters: dict[str, Any] | None = None,
) -> ApprovalRequest:
    req = ApprovalRequest(
        restaurant_id=restaurant_id,
        action_name=action_name,
        decision_id=decision_id,
        plan_id=plan_id,
        approval_level=approval_level,
        reason=reason,
        parameters=parameters or {},
    )
    _pending.appendleft(req)

    try:
        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            await r.lpush(_PENDING_KEY, json.dumps(req.model_dump(mode="json"), default=str))
    except Exception:
        logger.debug("Failed to persist approval request to Redis", exc_info=True)

    logger.info(
        "Approval request created: action=%s level=%s restaurant=%s",
        action_name, approval_level, restaurant_id,
    )
    return req


async def approve(request_id: str, resolved_by: str = "") -> ApprovalRequest | None:
    req = _find_pending(request_id)
    if req is None:
        return None

    req.status = "APPROVED"
    req.resolved_at = datetime.now(timezone.utc).isoformat()
    req.resolved_by = resolved_by
    _pending.remove(req)
    _history.appendleft(req)
    await _sync_redis()

    logger.info("Approval granted: %s by %s", request_id, resolved_by)
    return req


async def reject(request_id: str, resolved_by: str = "") -> ApprovalRequest | None:
    req = _find_pending(request_id)
    if req is None:
        return None

    req.status = "REJECTED"
    req.resolved_at = datetime.now(timezone.utc).isoformat()
    req.resolved_by = resolved_by
    _pending.remove(req)
    _history.appendleft(req)
    await _sync_redis()

    logger.info("Approval rejected: %s by %s", request_id, resolved_by)
    return req


async def get_pending(restaurant_id: str | None = None) -> list[dict[str, Any]]:
    items = list(_pending)
    if restaurant_id:
        items = [r for r in items if r.restaurant_id == restaurant_id]
    return [r.model_dump(mode="json") for r in items]


async def get_approval_history(limit: int = 50) -> list[dict[str, Any]]:
    return [r.model_dump(mode="json") for r in list(_history)[:limit]]


def _find_pending(request_id: str) -> ApprovalRequest | None:
    for req in _pending:
        if req.request_id == request_id:
            return req
    return None


async def _sync_redis() -> None:
    try:
        from app.config.redis_client import get_redis, is_redis_available

        if await is_redis_available():
            r = await get_redis()
            pipe = r.pipeline()
            pipe.delete(_PENDING_KEY)
            for req in _pending:
                pipe.rpush(_PENDING_KEY, json.dumps(req.model_dump(mode="json"), default=str))
            await pipe.execute()
    except Exception:
        logger.debug("Failed to sync approvals to Redis", exc_info=True)


def reset_approvals() -> None:
    _pending.clear()
    _history.clear()
