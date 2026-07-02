"""Inventory Agent — inventory prediction, stockout risk, restock recommendations."""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import BaseAgent


class InventoryAgent(BaseAgent):
    name = "InventoryAgent"
    domain = "inventory"

    async def gather(self, db: Any, restaurant_id: str, query: str) -> dict[str, Any]:
        from app.tools import inventory_tool

        return await inventory_tool(db, restaurant_id)
