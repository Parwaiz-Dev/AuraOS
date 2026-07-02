"""Multi-Agent exceptions."""

from __future__ import annotations


class AgentError(Exception):
    """Base exception for the multi-agent subsystem."""


class AgentNotFoundError(AgentError):
    """Raised when a registered agent is not found."""


class AgentBusyError(AgentError):
    """Raised when an agent cannot accept new tasks."""


class TaskAssignmentError(AgentError):
    """Raised when task assignment fails."""


class MessageDeliveryError(AgentError):
    """Raised when agent message delivery fails."""
