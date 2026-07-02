"""RBAC tests — privileged endpoints restricted to OWNER and ADMIN.

Covers:
- POST /api/v1/models/retrain
- POST /api/v1/rag/upload

Non-privileged roles (WAITER, KITCHEN, RECEPTION) must receive 403.
ADMIN and OWNER must NOT receive 403 (they pass the role gate).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import _role_token


def _headers(role: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_role_token(role)}"}


@pytest.mark.asyncio
class TestRetrainRBAC:
    """Role enforcement on POST /api/v1/models/retrain."""

    @pytest.mark.parametrize("role", ["WAITER", "KITCHEN", "RECEPTION"])
    async def test_non_privileged_roles_forbidden(self, client: AsyncClient, role: str) -> None:
        response = await client.post(
            "/api/v1/models/retrain",
            headers=_headers(role),
            json={"model": "revenue_forecast"},
        )
        assert response.status_code == 403

    @pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
    async def test_privileged_roles_pass_gate(self, client: AsyncClient, role: str) -> None:
        """ADMIN/OWNER must NOT be blocked by RBAC (200 or 503, never 403)."""
        response = await client.post(
            "/api/v1/models/retrain",
            headers=_headers(role),
            json={"model": "revenue_forecast"},
        )
        assert response.status_code != 403
        assert response.status_code in (200, 503)


@pytest.mark.asyncio
class TestUploadRBAC:
    """Role enforcement on POST /api/v1/rag/upload."""

    @pytest.mark.parametrize("role", ["WAITER", "KITCHEN", "RECEPTION"])
    async def test_non_privileged_roles_forbidden(self, client: AsyncClient, role: str) -> None:
        response = await client.post(
            "/api/v1/rag/upload",
            headers=_headers(role),
            files={"file": ("doc.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 403

    @pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
    async def test_privileged_roles_pass_gate(self, client: AsyncClient, role: str) -> None:
        """ADMIN/OWNER must pass the role gate (200, never 403)."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers=_headers(role),
            files={"file": ("doc.txt", b"hello world for rbac", "text/plain")},
        )
        assert response.status_code != 403
        assert response.status_code == 200

    async def test_missing_auth_still_401(self, client: AsyncClient) -> None:
        """No token should still be 401 (auth before authz)."""
        response = await client.post(
            "/api/v1/rag/upload",
            files={"file": ("doc.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 401
