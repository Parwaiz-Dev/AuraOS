"""Step: Generate copilot response via the AI service chain."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class CopilotResponseStep(WorkflowStep):
    name = "copilot_response"
    timeout_seconds = 60.0

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        message = ctx.metadata.get("message", "")
        if not message:
            return {"answer": "", "reason": "no_message"}

        from app.config.database import _async_session_factory
        from app.services.copilot_service import process_chat

        async with _async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SET TRANSACTION READ ONLY"))
            result = await process_chat(
                db=session,
                restaurant_id=ctx.restaurant_id,
                message=message,
            )

        logger.info("Copilot response for restaurant=%s intent=%s", ctx.restaurant_id, result.get("intent"))
        return {
            "answer": result.get("answer", ""),
            "intent": result.get("intent", ""),
            "confidence": result.get("confidence", 0.0),
            "provider": result.get("provider", ""),
        }
