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


class CustomerSegmentAssignment(BaseModel):
    customerId: str
    name: str
    segment: str
    recencyDays: int
    frequency: int
    monetary: float
    totalSpent: float


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


# ── Milestone 4: Model Management ────────────────────────────────────────────────


class ModelMetricsResponse(BaseModel):
    """Response from GET /api/v1/metrics/models."""

    totalModels: int
    healthyModels: int
    failedModels: int
    averageAccuracy: float
    models: dict[str, Any]  # model_name → { status, active_count, failed_count, total_versions }


class ModelHealthItem(BaseModel):
    """Per-model health status entry."""

    status: str  # healthy | failed | no_model
    active_count: int
    failed_count: int
    total_versions: int


class ModelHealthResponse(BaseModel):
    """Response from GET /api/v1/models/health."""

    models: dict[str, ModelHealthItem]


class RetrainRequest(BaseModel):
    """Request body for POST /api/v1/models/retrain."""

    model: str = Field(
        ...,
        pattern=r"^(revenue_forecast|order_forecast|customer_segmentation|recommendation_engine|wait_time_prediction|inventory_prediction)$",
        description="Model name to retrain",
    )


class RetrainResponse(BaseModel):
    """Response from POST /api/v1/models/retrain."""

    status: str  # "started"
    model: str
    message: str


# ── Milestone 5: AI Copilot ─────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Request body for POST /api/v1/copilot/chat."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural language question from the restaurant owner",
    )


class ChatExplanation(BaseModel):
    """Structured explanation extracted from the AI response."""

    reasons: list[str] = Field(default_factory=list, description="Key reasons identified")
    trends: list[str] = Field(default_factory=list, description="Trends detected")
    recommendations: list[str] = Field(default_factory=list, description="Actionable recommendations")
    summary: str = Field(default="", description="One-line summary of the answer")


class ChatResponse(BaseModel):
    """Response from POST /api/v1/copilot/chat."""

    answer: str = Field(..., description="AI-generated natural language answer")
    sources: list[str] = Field(default_factory=list, description="Data sources used")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    explanation: ChatExplanation | None = Field(default=None, description="Structured explanation")
    intent: str = Field(default="general", description="Classified intent")
    provider: str = Field(default="mock", description="LLM provider used")
    response_time_ms: int = Field(default=0, description="Response time in milliseconds")


class CopilotStatsResponse(BaseModel):
    """Response from GET /api/v1/copilot/stats."""

    questionsAnswered: int = Field(default=0, description="Total questions answered since startup")
    averageResponseTime: float = Field(default=0.0, description="Average response time in ms")
    provider: str = Field(default="mock", description="Current LLM provider")


# ── Milestone 6: Proactive Insights ────────────────────────────────────────────


class InsightAnomaly(BaseModel):
    """A single anomaly detected in the insight report."""

    type: str = Field(..., description="Anomaly type: revenue_drop, revenue_spike, order_spike, etc.")
    severity: str = Field(..., description="low, medium, high, critical")
    metric: str = Field(..., description="Metric being measured")
    current_value: float = Field(..., description="Observed value")
    expected_value: float = Field(..., description="Expected/median value")
    deviation_pct: float = Field(..., description="Percentage deviation from expected")
    detected_at: str = Field(default="", description="ISO timestamp of detection")
    description: str = Field(default="", description="Human-readable description")


class InsightTrend(BaseModel):
    """A single trend detected in the insight report."""

    type: str = Field(..., description="Trend type: revenue_growth, revenue_decline, etc.")
    metric: str = Field(..., description="Metric being tracked")
    direction: str = Field(..., description="up, down, stable")
    current_value: float = Field(..., description="Current period value")
    previous_value: float = Field(..., description="Previous period value")
    change_pct: float = Field(..., description="Percentage change")
    period: str = Field(..., description="week or month")
    description: str = Field(default="", description="Human-readable description")


class InsightOpportunity(BaseModel):
    """A single growth opportunity detected."""

    type: str = Field(..., description="Opportunity type: upsell, peak_period, high_value_customer, menu_optimization")
    severity: str = Field(default="medium", description="low, medium, high")
    category: str = Field(default="", description="Category: menu_optimization, operations, customers, menu")
    detail: str = Field(default="", description="Detailed description")
    recommendation: str = Field(default="", description="Actionable recommendation")
    potential_value: str = Field(default="", description="Estimated potential value")
    detected_at: str = Field(default="", description="ISO timestamp")


class InsightRisk(BaseModel):
    """A single risk detected."""

    type: str = Field(..., description="Risk type: churn_risk, stockout_risk, revenue_decline_risk")
    severity: str = Field(..., description="low, medium, high, critical")
    category: str = Field(default="", description="Category: customers, inventory, revenue")
    detail: str = Field(default="", description="Detailed description")
    recommendation: str = Field(default="", description="Actionable recommendation")
    probability: float = Field(default=0.0, ge=0.0, le=1.0, description="Estimated probability 0-1")
    detected_at: str = Field(default="", description="ISO timestamp")


class InsightCounts(BaseModel):
    """Summary counts for each detection category."""

    anomalies: int = Field(default=0)
    trends: int = Field(default=0)
    opportunities: int = Field(default=0)
    risks: int = Field(default=0)


class InsightResponse(BaseModel):
    """Response from GET /api/v1/insights/daily."""

    restaurant_id: str = Field(..., description="Restaurant UUID")
    generated_at: str = Field(..., description="ISO timestamp of generation")
    summary: str = Field(default="", description="Natural language summary")
    anomalies: list[InsightAnomaly] = Field(default_factory=list)
    trends: list[InsightTrend] = Field(default_factory=list)
    opportunities: list[InsightOpportunity] = Field(default_factory=list)
    risks: list[InsightRisk] = Field(default_factory=list)
    counts: InsightCounts = Field(default_factory=InsightCounts)


class WeeklyReportResponse(BaseModel):
    """Response from GET /api/v1/insights/weekly."""

    restaurant_id: str = Field(..., description="Restaurant UUID")
    generated_at: str = Field(..., description="ISO timestamp of generation")
    week_start: str = Field(default="", description="Start date of the report week")
    week_end: str = Field(default="", description="End date of the report week")
    summary: str = Field(default="", description="Natural language weekly summary")
    anomalies: list[InsightAnomaly] = Field(default_factory=list)
    trends: list[InsightTrend] = Field(default_factory=list)
    opportunities: list[InsightOpportunity] = Field(default_factory=list)
    risks: list[InsightRisk] = Field(default_factory=list)
    counts: InsightCounts = Field(default_factory=InsightCounts)


class InsightHistoryResponse(BaseModel):
    """Response from GET /api/v1/insights/history."""

    entries: list[dict] = Field(default_factory=list, description="List of stored insight entries")
    total: int = Field(default=0, description="Total entries returned")


# ── Milestone 8: Event-Driven Architecture ────────────────────────────────────


class EventResponse(BaseModel):
    """Serialized event for API responses."""

    event_id: str = Field(..., description="Unique event identifier")
    event_name: str = Field(..., description="Event type name")
    restaurant_id: str = Field(default="", description="Restaurant UUID")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    status: str = Field(default="pending", description="Processing status")
    processed_at: str | None = Field(default=None, description="When the event was processed")
    retry_count: int = Field(default=0, description="Number of retry attempts")
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaginatedEventResponse(BaseModel):
    """Paginated list of events."""

    items: list[dict[str, Any]] = Field(default_factory=list)
    total: int = Field(default=0)
    page: int = Field(default=1)
    page_size: int = Field(default=50)
    pages: int = Field(default=0)


class EventStatsResponse(BaseModel):
    """Aggregated event bus statistics."""

    total_events: int = Field(default=0)
    processed: int = Field(default=0)
    failed: int = Field(default=0)
    pending: int = Field(default=0)
    retries: int = Field(default=0)
    average_processing_time_ms: float = Field(default=0.0)
    throughput_per_minute: float = Field(default=0.0)
    event_types: dict[str, int] = Field(default_factory=dict)
    bus_total_published: int = Field(default=0)
    bus_total_processed: int = Field(default=0)
    bus_total_failed: int = Field(default=0)
    bus_total_retries: int = Field(default=0)
    dead_letter_count: int = Field(default=0)


class EventReplayRequest(BaseModel):
    """Request body for POST /api/v1/events/replay."""

    event_id: str | None = Field(default=None, description="Replay a single event by ID")
    event_type: str | None = Field(default=None, description="Replay all events of this type")
    restaurant_id: str | None = Field(default=None, description="Replay events for this restaurant")
    start_date: str | None = Field(default=None, description="ISO 8601 start date")
    end_date: str | None = Field(default=None, description="ISO 8601 end date")
    replay_dlq: bool = Field(default=False, description="Replay all dead letter queue entries")


class EventReplayResponse(BaseModel):
    """Response from POST /api/v1/events/replay."""

    replayed: int = Field(default=0, description="Number of events replayed")
    failed: int = Field(default=0, description="Number of replay failures")
    message: str = Field(default="", description="Summary message")


class DeadLetterEntryResponse(BaseModel):
    """A failed event in the dead letter queue."""

    event: dict[str, Any] = Field(default_factory=dict)
    handler_name: str = Field(default="")
    failed_at: str = Field(default="")
    retry_count: int = Field(default=0)