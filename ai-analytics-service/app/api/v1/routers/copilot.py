"""AI Copilot router — chat and stats endpoints for Milestone 5."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.security import CurrentUser, TokenPayload
from app.schemas import ChatRequest, ChatResponse, CopilotStatsResponse, ErrorResponse
from app.services.copilot_service import get_copilot_stats, process_chat

router = APIRouter(prefix="/copilot")


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
    summary="Chat with the AI Copilot",
    description="Ask a natural language question about your restaurant's analytics. "
    "Supported topics: revenue, customers, menu, recommendations, operations, "
    "inventory, and forecasting.",
)
async def chat(
    body: ChatRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Process a natural language query and return an AI-generated answer.

    The copilot:
    1. Classifies the intent of the question
    2. Gathers relevant analytics context from all services
    3. Builds a prompt with conversation history
    4. Calls the configured LLM provider
    5. Formats the response with confidence estimation
    6. Extracts structured explanation (reasons, trends, recommendations)
    """
    result = await process_chat(
        db=db,
        restaurant_id=user.restaurantId,
        message=body.message,
    )
    return ChatResponse(**result)


@router.get(
    "/stats",
    response_model=CopilotStatsResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Get AI Copilot usage statistics",
    description="Returns the number of questions answered, average response time, "
    "and the current LLM provider since the service was last started.",
)
async def stats(
    user: CurrentUser,
) -> CopilotStatsResponse:
    """Return copilot usage statistics (in-memory, resets on restart)."""
    data = await get_copilot_stats()
    return CopilotStatsResponse(**data)