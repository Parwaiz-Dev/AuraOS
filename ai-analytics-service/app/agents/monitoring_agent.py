"""Monitoring Agent — model health, drift detection, and system monitoring."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent


class MonitoringAgent(SpecializedAgent):
    agent_id = "monitoring_agent"
    name = "Monitoring Agent"
    description = "Model health, drift detection, and system monitoring"
    capabilities = ["monitoring", "drift_detection", "model_health", "system_health"]
    supported_events = ["ModelRetrained", "ModelDriftDetected"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        from app.monitoring.model_health import compute_model_health
        health = compute_model_health()
        healthy = sum(1 for v in health.values() if v.get("status") == "healthy")
        failed = sum(1 for v in health.values() if v.get("status") == "failed")
        return {
            "models_healthy": healthy,
            "models_failed": failed,
            "total_models": len(health),
            "source": self.agent_id,
        }
