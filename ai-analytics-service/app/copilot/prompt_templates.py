"""Prompt Templates — build structured prompts for the LLM provider.

Never includes raw database rows. All data is pre-aggregated by the context
builder and formatted into a clean, readable prompt structure.
"""

from __future__ import annotations

import json

from app.copilot.intent_classifier import Intent


SYSTEM_PROMPT = """You are AuraOS AI Copilot, a restaurant business intelligence assistant.
You help restaurant owners understand their data and make better decisions.

Your rules:
1. Answer ONLY based on the provided context data. Do not invent numbers.
2. If the context does not contain enough data to answer, say so clearly.
3. Be concise but insightful. Highlight trends, anomalies, and actionable recommendations.
4. Use Indian Rupees (₹) for all currency values.
5. When numbers are provided, reference them explicitly.
6. If the user asks about something outside your capabilities, politely redirect them.
7. Never mention raw database tables, SQL queries, or internal implementation details.
8. Always include specific, actionable recommendations when relevant.

Your capabilities:
- Revenue analysis (daily, weekly, monthly trends, comparisons)
- Customer insights (VIPs, churn risk, segmentation)
- Menu performance (top items, categories, frequently bought together)
- Forecasting (next week/month predictions)
- Inventory management (stock levels, reorder alerts)
- Operations (wait times, peak hours, kitchen load)
- Recommendations (what to promote, what pairs well)
"""


def build_prompt(
    message: str,
    context: dict,
    *,
    conversation_history: str = "",
    intent: Intent | None = None,
) -> str:
    """Build a complete prompt for the LLM provider.

    Args:
        message: The user's natural language question.
        context: The compact context dict from context_builder.
        conversation_history: Formatted prior conversation history.
        intent: The detected intent (optional, for prompt tailoring).
    """
    parts: list[str] = [SYSTEM_PROMPT]

    # Add conversation history if available
    if conversation_history and conversation_history != "No prior conversation.":
        parts.append("\n## Prior Conversation\n")
        parts.append(conversation_history)

    # Add context data
    parts.append("\n## Current Business Data\n")
    parts.append("```json")
    parts.append(json.dumps(context.get("data", {}), indent=2, default=str))
    parts.append("```")

    # Add intent-specific guidance
    if intent:
        parts.append(_intent_guidance(intent))

    # Add the user's question
    parts.append("\n## User Question\n")
    parts.append(message)

    parts.append("\n## Instructions\n")
    parts.append("Provide a helpful, concise answer based on the data above. ")
    parts.append("Include specific numbers when available. ")
    parts.append("End with 1-2 actionable recommendations if relevant.")

    return "\n".join(parts)


def build_simple_prompt(message: str, context: dict) -> str:
    """Build a prompt without conversation history (for stateless calls)."""
    return build_prompt(message, context, conversation_history="")


def _intent_guidance(intent: Intent) -> str:
    """Return guidance specific to the detected intent."""
    guidance_map = {
        Intent.REVENUE: (
            "\n## Guidance\n"
            "Focus on revenue trends, growth rates, and comparisons. "
            "Highlight the best and worst performing periods. "
            "Suggest specific actions to improve revenue."
        ),
        Intent.CUSTOMERS: (
            "\n## Guidance\n"
            "Focus on customer segments, VIP identification, and churn risks. "
            "Suggest retention strategies for at-risk customers. "
            "Highlight opportunities to convert regular customers to VIPs."
        ),
        Intent.FORECAST: (
            "\n## Guidance\n"
            "Present the forecast clearly with confidence levels. "
            "Highlight the trend direction (up/down/stable). "
            "Suggest preparations based on the forecast."
        ),
        Intent.INVENTORY: (
            "\n## Guidance\n"
            "Focus on items that need immediate attention. "
            "Prioritize by urgency (days remaining). "
            "Suggest specific reorder quantities."
        ),
        Intent.OPERATIONS: (
            "\n## Guidance\n"
            "Focus on wait times, peak hours, and kitchen efficiency. "
            "Suggest staffing or process improvements. "
            "Highlight bottlenecks."
        ),
        Intent.MENU: (
            "\n## Guidance\n"
            "Focus on top-performing items and categories. "
            "Suggest which items to promote or potentially remove. "
            "Highlight frequently bought together pairs for combo creation."
        ),
        Intent.RECOMMENDATIONS: (
            "\n## Guidance\n"
            "Focus on item pairings and cross-sell opportunities. "
            "Suggest combo deals based on co-occurrence data. "
            "Recommend specific items to promote."
        ),
        Intent.GENERAL: (
            "\n## Guidance\n"
            "Provide a general overview of the restaurant's performance. "
            "Highlight the most important metrics and any anomalies. "
            "Suggest areas that need attention."
        ),
    }
    return guidance_map.get(intent, "")