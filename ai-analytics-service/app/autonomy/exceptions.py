"""Autonomy exceptions."""

from __future__ import annotations


class AutonomyError(Exception):
    """Base exception for the autonomy subsystem."""


class ActionNotFoundError(AutonomyError):
    """Raised when a registered action is not found."""


class ApprovalRequiredError(AutonomyError):
    """Raised when an action requires approval before execution."""

    def __init__(self, action_name: str, level: str) -> None:
        self.action_name = action_name
        self.level = level
        super().__init__(f"Action '{action_name}' requires {level} approval")


class PolicyViolationError(AutonomyError):
    """Raised when an action violates a safety policy."""


class LowConfidenceError(AutonomyError):
    """Raised when decision confidence is below threshold."""
