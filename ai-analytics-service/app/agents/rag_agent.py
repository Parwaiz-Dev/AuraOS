"""RAG Agent — document search and knowledge retrieval."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent


class RAGAgent(SpecializedAgent):
    agent_id = "rag_agent"
    name = "RAG Agent"
    description = "Document search and retrieval-augmented generation"
    capabilities = ["rag", "document_search", "knowledge_base"]
    supported_events = ["DocumentUploaded", "RAGIndexed"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        query = params.get("query", params.get("request", ""))
        if not query:
            return {"results": 0, "source": self.agent_id}
        try:
            from app.services.rag_service import search_documents
            response = await search_documents(query=query, restaurant_id=rid, top_k=5)
            return {"results": response.total, "source": self.agent_id}
        except Exception:
            return {"results": 0, "source": self.agent_id}
