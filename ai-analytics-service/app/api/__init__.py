"""API v1 package — all routes are mounted under /api/v1."""

from fastapi import APIRouter

from app.api.v1.routers import dashboard, health, revenue, top_items

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

# Future milestones will add routers here:
# api_router.include_router(forecasting.router, tags=["Forecasting"])
# api_router.include_router(customers.router, tags=["Customers"])
# api_router.include_router(recommendations.router, tags=["Recommendations"])
# …