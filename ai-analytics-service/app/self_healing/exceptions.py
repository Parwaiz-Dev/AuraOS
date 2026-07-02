"""Self-Healing exceptions."""

from __future__ import annotations


class SelfHealingError(Exception):
    """Base exception for self-healing subsystem."""


class ComponentUnhealthyError(SelfHealingError):
    """A component has been detected as unhealthy."""

    def __init__(self, component: str, reason: str = "") -> None:
        self.component = component
        self.reason = reason
        super().__init__(f"Component '{component}' is unhealthy: {reason}")


class RecoveryFailedError(SelfHealingError):
    """A recovery action could not restore the component."""

    def __init__(self, component: str, action: str, reason: str = "") -> None:
        self.component = component
        self.action = action
        super().__init__(f"Recovery '{action}' failed for '{component}': {reason}")


class CircuitOpenError(SelfHealingError):
    """The circuit breaker is open and requests are being rejected."""

    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"Circuit breaker '{name}' is OPEN — requests blocked")


class DependencyUnavailableError(SelfHealingError):
    """A required external dependency is unavailable."""

    def __init__(self, dependency: str) -> None:
        self.dependency = dependency
        super().__init__(f"Dependency '{dependency}' is unavailable")
