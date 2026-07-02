"""Tests for the Approval Engine."""

from __future__ import annotations

import pytest

from app.autonomy.approval_engine import (
    approve,
    create_approval,
    get_pending,
    reject,
    reset_approvals,
)


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_approvals()


@pytest.mark.asyncio
class TestApprovalEngine:
    async def test_create_approval(self) -> None:
        req = await create_approval(
            restaurant_id="r1",
            action_name="retrain_model",
            decision_id="d1",
            plan_id="p1",
            approval_level="OWNER_APPROVAL",
            reason="Model drift detected",
        )
        assert req.request_id
        assert req.status == "PENDING"
        assert req.action_name == "retrain_model"

    async def test_get_pending(self) -> None:
        await create_approval("r1", "retrain_model", "d1", "p1", "OWNER_APPROVAL")
        await create_approval("r2", "modify_inventory", "d2", "p2", "OWNER_APPROVAL")

        all_pending = await get_pending()
        assert len(all_pending) == 2

        r1_pending = await get_pending(restaurant_id="r1")
        assert len(r1_pending) == 1
        assert r1_pending[0]["action_name"] == "retrain_model"

    async def test_approve(self) -> None:
        req = await create_approval("r1", "retrain_model", "d1", "p1", "OWNER_APPROVAL")
        result = await approve(req.request_id, resolved_by="admin@test.com")

        assert result is not None
        assert result.status == "APPROVED"
        assert result.resolved_by == "admin@test.com"
        assert result.resolved_at is not None

        pending = await get_pending()
        assert len(pending) == 0

    async def test_reject(self) -> None:
        req = await create_approval("r1", "retrain_model", "d1", "p1", "OWNER_APPROVAL")
        result = await reject(req.request_id, resolved_by="admin@test.com")

        assert result is not None
        assert result.status == "REJECTED"

        pending = await get_pending()
        assert len(pending) == 0

    async def test_approve_nonexistent(self) -> None:
        result = await approve("nonexistent-id")
        assert result is None

    async def test_reject_nonexistent(self) -> None:
        result = await reject("nonexistent-id")
        assert result is None

    async def test_multiple_approvals(self) -> None:
        req1 = await create_approval("r1", "action_a", "d1", "p1", "OWNER_APPROVAL")
        req2 = await create_approval("r1", "action_b", "d2", "p2", "ADMIN_APPROVAL")

        await approve(req1.request_id)
        pending = await get_pending()
        assert len(pending) == 1
        assert pending[0]["action_name"] == "action_b"

    async def test_approval_preserves_parameters(self) -> None:
        req = await create_approval(
            "r1", "retrain_model", "d1", "p1", "OWNER_APPROVAL",
            parameters={"model_name": "revenue_forecast"},
        )
        pending = await get_pending()
        assert pending[0]["parameters"]["model_name"] == "revenue_forecast"
