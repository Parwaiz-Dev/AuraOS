"""API v1 package — all routes are mounted under /api/v1."""

from fastapi import APIRouter

from app.api.v1.routers import (
    agents,
    autonomy,
    copilot,
    customers,
    dashboard,
    events,
    forecast,
    graph,
    healing,
    health,
    insights,
    mcp,
    metrics,
    models,
    predict,
    rag,
    recommendations,
    revenue,
    top_items,
    workflows,
)

api_router = APIRouter()

# ── Sub-routers ─────────────────────────────────────────────────────────────────

# Milestone 1
api_router.include_router(health.router, tags=["Health"])

# Milestone 2 — Revenue Analytics
api_router.include_router(revenue.router, tags=["Revenue Analytics"])

# Milestone 2 — Dashboard
api_router.include_router(dashboard.router, tags=["Dashboard"])

# Milestone 2 — Top Items
api_router.include_router(top_items.router, tags=["Top Items"])

# Milestone 3 — Forecasting
api_router.include_router(forecast.router, tags=["Forecasting"])

# Milestone 3 — Customer Segmentation
api_router.include_router(customers.router, tags=["Customers"])

# Milestone 3 — Recommendations
api_router.include_router(recommendations.router, tags=["Recommendations"])

# Milestone 3 — Prediction (Wait Time & Inventory)
api_router.include_router(predict.router, tags=["Prediction"])

# Milestone 4 — Model Management
api_router.include_router(metrics.router, tags=["Model Metrics"])
api_router.include_router(models.router, tags=["Model Management"])

# Milestone 5 — AI Copilot
api_router.include_router(copilot.router, tags=["AI Copilot"])

# Milestone 6 — Proactive Insights & Notifications
api_router.include_router(insights.router, tags=["Insights"])

# Milestone 7 — RAG (Retrieval-Augmented Generation)
api_router.include_router(rag.router, tags=["RAG"])

# Milestone 8 — Event-Driven Architecture
api_router.include_router(events.router, tags=["Events"])

# Milestone 9 — AI Workflow Orchestration
api_router.include_router(workflows.router, tags=["Workflows"])

# Milestone 10 — Fully Autonomous AI Restaurant OS
api_router.include_router(autonomy.router, tags=["Autonomy"])

# Milestone 11 — Multi-Agent AI System
api_router.include_router(agents.router, tags=["Agents"])

# Milestone 12 — Self-Healing AI Platform + MCP + LangGraph
api_router.include_router(healing.router, tags=["Health Dashboard"])
api_router.include_router(mcp.router, tags=["MCP"])
api_router.include_router(graph.router, tags=["LangGraph"])