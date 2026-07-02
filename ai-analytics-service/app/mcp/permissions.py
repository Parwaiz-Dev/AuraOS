"""MCP Permissions — role-based tool access control."""

from __future__ import annotations

import logging
from typing import Any

from app.mcp.models import ToolPermission

logger = logging.getLogger(__name__)

_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "ADMIN": {"read", "write", "execute", "admin"},
    "OWNER": {"read", "write", "execute", "admin"},
    "KITCHEN": {"read", "execute"},
    "WAITER": {"read"},
    "RECEPTION": {"read"},
}


class PermissionManager:
    """Manages tool-level permission checks."""

    def __init__(self) -> None:
        self._tool_overrides: dict[str, set[str]] = {}

    def check_permission(
        self,
        tool_name: str,
        required: list[str],
        user_role: str,
    ) -> bool:
        override = self._tool_overrides.get(tool_name)
        if override is not None:
            return any(p in override for p in required)

        role_perms = _ROLE_PERMISSIONS.get(user_role.upper(), set())
        return any(p in role_perms for p in required)

    def grant_tool_permission(
        self,
        tool_name: str,
        permissions: list[str],
    ) -> None:
        if tool_name not in self._tool_overrides:
            self._tool_overrides[tool_name] = set()
        self._tool_overrides[tool_name].update(permissions)

    def revoke_tool_permission(
        self,
        tool_name: str,
        permissions: list[str],
    ) -> None:
        if tool_name in self._tool_overrides:
            self._tool_overrides[tool_name] -= set(permissions)

    def get_tool_permissions(self, tool_name: str) -> set[str]:
        return self._tool_overrides.get(tool_name, set())

    def get_role_permissions(self, role: str) -> set[str]:
        return _ROLE_PERMISSIONS.get(role.upper(), set())

    def reset(self) -> None:
        self._tool_overrides.clear()


_manager: PermissionManager | None = None


def get_permission_manager() -> PermissionManager:
    global _manager
    if _manager is None:
        _manager = PermissionManager()
    return _manager


def reset_permission_manager() -> None:
    global _manager
    _manager = None
