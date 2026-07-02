"""Agent tools — thin async wrappers over existing M2–M7 services.

A "tool" is the reuse seam between an agent and the existing service layer. Each
tool takes a read-only DB session and a restaurant_id, calls the relevant
service(s), and returns a compact, JSON-serializable dict. Tools NEVER touch
repositories directly — they go through services, preserving the
Repository → Service → Router architecture.

All service imports are lazy (inside the function body) to keep the import graph
acyclic and to avoid importing heavy ML modules at startup.
"""

from __future__ import annotations

from app.tools.customer_tool import customer_tool
from app.tools.forecast_tool import forecast_tool
from app.tools.inventory_tool import inventory_tool
from app.tools.rag_tool import rag_tool
from app.tools.recommendation_tool import recommendation_tool
from app.tools.revenue_tool import revenue_tool
from app.tools.wait_time_tool import wait_time_tool

__all__ = [
    "customer_tool",
    "forecast_tool",
    "inventory_tool",
    "rag_tool",
    "recommendation_tool",
    "revenue_tool",
    "wait_time_tool",
]
