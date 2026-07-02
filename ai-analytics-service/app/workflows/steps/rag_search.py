"""Step: RAG document search."""

from __future__ import annotations

import logging
from typing import Any

from app.workflows.workflow import WorkflowStep
from app.workflows.workflow_context import WorkflowContext

logger = logging.getLogger(__name__)


class RAGSearchStep(WorkflowStep):
    name = "rag_search"
    timeout_seconds = 30.0

    def should_skip(self, ctx: WorkflowContext) -> bool:
        from app.config.settings import settings
        return not settings.RAG_ENABLED

    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        query = ctx.metadata.get("query", "")
        if not query:
            return {"results": [], "reason": "no_query"}

        from app.services.rag_service import search_documents

        response = await search_documents(
            query=query,
            restaurant_id=ctx.restaurant_id,
            top_k=5,
        )
        count = response.total
        logger.info("RAG search returned %d results for restaurant=%s", count, ctx.restaurant_id)
        return {"result_count": count}
