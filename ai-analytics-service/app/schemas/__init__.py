"""Pydantic schemas for request/response serialization.

These are the publicly visible contracts of the API.  They are intentionally
decoupled from the SQLAlchemy models so the database schema can evolve
independently of the API surface.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Health ──────────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    """Response from GET /api/v1/health."""

    status: str
    service: str
    version: str
    database: str
    redis: str
    authenticated: bool
    user: dict[str, str]


# ── Common ──────────────────────────────────────────────────────────────────────


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str


class PaginationParams(BaseModel):
    """Common pagination query parameters."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=50, ge=1, le=500, description="Items per page")


class DateRangeParams(BaseModel):
    """Common date range query parameters."""

    start_date: str | None = Field(default=None, description="ISO 8601 start date")
    end_date: str | None = Field(default=None, description="ISO 8601 end date")


class PaginatedResponse(BaseModel):
    """Wrapper for paginated list responses."""

    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int


# ── Revenue ─────────────────────────────────────────────────────────────────────


class DailyRevenue(BaseModel):
    date: str
    revenue: float
    order_count: int
    average_order_value: float


class WeeklyRevenue(BaseModel):
    week_start: str
    week_end: str
    revenue: float
    order_count: int
    growth_percentage: float | None = None


class MonthlyRevenue(BaseModel):
    month: str  # YYYY-MM
    revenue: float
    order_count: int
    growth_percentage: float | None = None


class YearlyRevenue(BaseModel):
    year: int
    revenue: float
    order_count: int


# ── Top Items ───────────────────────────────────────────────────────────────────


class TopItem(BaseModel):
    menu_item_id: str
    name: str
    category: str
    total_sold: int
    total_revenue: float
    rank: int


class TopCategory(BaseModel):
    category_id: str
    name: str
    total_sold: int
    total_revenue: float


class FrequentPair(BaseModel):
    item_a: str
    item_b: str
    co_occurrence_count: int
    confidence: float


# ── Customers ───────────────────────────────────────────────────────────────────


class CustomerSegment(BaseModel):
    segment_id: int
    segment_label: str
    customer_count: int
    average_clv: float
    characteristics: dict[str, Any]


class CustomerLTV(BaseModel):
    customer_id: str
    customer_name: str
    lifetime_value: float
    total_orders: int
    average_order_value: float
    days_since_last_order: int


class VIPCustomer(BaseModel):
    customer_id: str
    customer_name: str
    lifetime_value: float
    total_orders: int
    last_order_date: str


class ChurnRisk(BaseModel):
    customer_id: str
    customer_name: str
    churn_probability: float
    days_since_last_order: int
    risk_level: str  # low | medium | high


# ── Forecasting ─────────────────────────────────────────────────────────────────


class ForecastPoint(BaseModel):
    date: str
    predicted_revenue: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    forecast: list[ForecastPoint]
    confidence: float
    model_version: str
    generated_at: str


# ── Inventory ───────────────────────────────────────────────────────────────────


class InventoryPrediction(BaseModel):
    menu_item_id: str
    name: str
    current_stock: int
    predicted_usage_next_7d: float
    days_until_stockout: int | None
    reorder_recommendation: int


class ReorderRecommendation(BaseModel):
    menu_item_id: str
    name: str
    current_stock: int
    reorder_level: int
    recommended_reorder: int
    urgency: str  # low | medium | high | critical


class WasteAnalysis(BaseModel):
    menu_item_id: str
    name: str
    total_wasted: int
    waste_rate: float
    estimated_loss: float


# ── Wait Time ───────────────────────────────────────────────────────────────────


class WaitTimeEstimate(BaseModel):
    estimated_prep_minutes: float
    estimated_delivery_minutes: float | None
    kitchen_load: str  # low | medium | high
    confidence: float


class KitchenLoad(BaseModel):
    current_orders: int
    current_items: int
    average_wait_minutes: float
    load_level: str  # low | medium | high | critical


# ── Recommendations ─────────────────────────────────────────────────────────────


class Recommendation(BaseModel):
    menu_item_id: str
    name: str
    category: str
    price: float
    reason: str
    score: float


# ── Dashboard ───────────────────────────────────────────────────────────────────


class DashboardKPI(BaseModel):
    total_revenue_today: float
    total_orders_today: int
    average_order_value_today: float
    revenue_growth_vs_yesterday: float
    pending_orders: int
    active_tables: int


class SalesChart(BaseModel):
    labels: list[str]
    values: list[float]


class DashboardResponse(BaseModel):
    kpis: DashboardKPI
    hourly_sales: SalesChart
    weekly_sales: SalesChart
    monthly_sales: SalesChart
    top_items: list[TopItem]
    generated_at: str


# ── Health Score ────────────────────────────────────────────────────────────────


class HealthScore(BaseModel):
    score: int  # 0-100
    breakdown: dict[str, float]
    recommendations: list[str]
    generated_at: str


# ── Insights ────────────────────────────────────────────────────────────────────


class Insight(BaseModel):
    category: str  # revenue | customers | operations | menu
    severity: str  # positive | neutral | warning
    message: str
    metrics: dict[str, Any] | None = None


class InsightsResponse(BaseModel):
    insights: list[Insight]
    generated_at: str