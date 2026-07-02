"""Copilot Agent — natural language Q&A via the AI copilot pipeline."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import SpecializedAgent, agent_session


class CopilotAgent(SpecializedAgent):
    agent_id = "copilot_agent"
    name = "Copilot Agent"
    description = "Natural language business intelligence via the AI Copilot"
    capabilities = ["copilot", "chat", "nlp", "question_answering"]
    supported_events = ["CopilotConversationStarted", "CopilotConversationCompleted"]

    async def process(self, params: dict[str, Any]) -> dict[str, Any]:
        rid = params.get("restaurant_id", "")
        message = params.get("message", params.get("request", ""))
        if not message:
            return {"answer": "", "source": self.agent_id}
        async with agent_session() as session:
            from app.services.copilot_service import process_chat
            result = await process_chat(db=session, restaurant_id=rid, message=message)
            return {
                "answer": result.get("answer", ""),
                "intent": result.get("intent", ""),
                "confidence": result.get("confidence", 0.0),
                "source": self.agent_id,
            }
