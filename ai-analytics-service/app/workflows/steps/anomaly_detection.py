"""Step: Run anomaly detection."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class AnomalyDetectionStep(WorkflowStep):
    name = "anomaly_detection"
    timeout_seconds = 60.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        from app.config.database import _async_session_factory
        from app.insights.anomaly_detector import AnomalyDetector

        detector = AnomalyDetector()
        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            result = await detector.detect_all(session, ctx.restaurant_id)

        count = len(result.anomalies)
        logger.info("Anomaly detection: %d anomalies for restaurant=%s", count, ctx.restaurant_id)
        return {"anomaly_count": count, "anomalies": [{"type": a.type, "severity": a.severity} for a in result.anomalies]}
