# AuraOS AI Analytics Service

Production-grade AI/ML analytics microservice for the AuraOS restaurant platform.
Provides forecasting, recommendations, customer segmentation, and operational
insights by consuming **read-only** data from the AuraOS PostgreSQL database.

## Architecture

```
Next.js Website / Waiter App / POS / Customer App
         │
         ▼
  AuraOS Core API (Node.js/Express)
         │
         ├──► PostgreSQL (read/write)
         │
         ▼
  AI Analytics Service (FastAPI) ◄── READ ONLY
         │
         ├──► PostgreSQL
         ├──► Redis (cache)
         ├──► APScheduler (background training)
         └──► Joblib + JSON (trained model storage + registry)
```

## Features

| Feature | Endpoints | ML Engine |
|---|---|---|
| Revenue Analytics | `/analytics/revenue/*` | Pandas + NumPy |
| Top Selling Items | `/analytics/top-items` | SQL Co-occurrence |
| Customer Segmentation | `/customers/segments` | KMeans + RFM |
| Revenue Forecast | `/forecast/revenue` | Prophet |
| Order Forecast | `/forecast/orders` | Prophet |
| Inventory Prediction | `/predict/inventory` | Moving Averages |
| Wait Time Prediction | `/predict/wait-time` | XGBoost |
| Recommendation Engine | `/recommendations/items` | Association Rules |
| Dashboard | `/dashboard` | Aggregation + Redis |
| AI Copilot (M5) | `/copilot/chat`, `/copilot/stats` | Intent Classification + LLM (Gemini/OpenAI/DeepSeek/Mock) |
| Proactive Insights (M6) | `/insights/daily`, `/insights/weekly`, `/insights/history` | Isolation Forest + Trend Analysis + Risk Detection + Notifications |

## Quick Start

### Prerequisites

- Python 3.12+
- PostgreSQL (AuraOS database)
- Redis 7+
- Docker (optional)

### Local Development

```bash
cd ai-analytics-service

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env  # Already done for local dev

# Run the server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Docker

```bash
# From the project root (AuraOS/)
docker compose -f docker-compose.yml -f docker-compose.redis.yml up ai-analytics
```

### Verify

```bash
# Health check (no auth)
curl http://localhost:8000/health

# Authenticated health
curl -H "Authorization: Bearer <jwt_token>" http://localhost:8000/api/v1/health

# OpenAPI docs
open http://localhost:8000/docs
```

## Authentication

The service validates JWT tokens issued by the AuraOS Core API.  No separate
authentication system exists.  Every data endpoint requires a valid Bearer token
with the payload:

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "restaurantId": "restaurant-uuid",
  "exp": 1712345678
}
```

The `restaurantId` claim enforces multi-tenancy — all data queries are scoped
to the authenticated restaurant.

## Read-Only Guarantee

Every database session is opened with `SET TRANSACTION READ ONLY`.  The service
has **no code paths** that execute INSERT, UPDATE, DELETE, or DDL statements
against business tables.  This is enforced at the database protocol level.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | (see `.env`) | Async PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET` | Yes | (dev default) | Must match AuraOS Core API |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `CELERY_BROKER_URL` | No | `redis://localhost:6379/0` | Celery message broker |
| `MODELS_DIR` | No | `./models` | Directory for trained model files |

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=app --cov-report=term-missing
```

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Milestones

### Milestone 1 ✅
- [x] Project scaffolding
- [x] FastAPI application
- [x] Database connection (read-only)
- [x] JWT validation
- [x] Docker support
- [x] Health endpoints
- [x] Test suite

### Milestone 2 ✅
- [x] Revenue analytics endpoints (`/analytics/revenue/daily`, `/weekly`, `/monthly`, `/yearly`, `/trends`, `/peak-hours`)
- [x] Top items / categories (`/analytics/top-items`, `/analytics/top-categories`)
- [x] Frequently bought together (`/analytics/frequently-bought-together`) — SQL-only aggregation
- [x] Dashboard KPIs (`/dashboard`) — Redis-cached (TTL 300s)
- [x] Repository / Service / Router layer architecture
- [x] Test suite (42 tests across 3 modules)

### Milestone 3 ✅ (Current)
- [x] Revenue Forecast — `GET /api/v1/forecast/revenue` (Prophet, days=7/30/90)
- [x] Order Forecast — `GET /api/v1/forecast/orders` (Prophet)
- [x] Customer Segmentation — `GET /api/v1/customers/segments` (KMeans + RFM, VIP/Loyal/Regular/At Risk/Lost)
- [x] Recommendation Engine — `GET /api/v1/recommendations/items` (Association Rules / Co-occurrence)
- [x] Wait Time Prediction — `GET /api/v1/predict/wait-time` (XGBoost Regressor)
- [x] Inventory Prediction — `GET /api/v1/predict/inventory` (Moving Averages / Depletion Dates)
- [x] Lazy model loading (never train on every request)
- [x] Redis caching with graceful degradation
- [x] Test suite (30 tests across 5 modules)

### Milestone 4 ✅
- [x] APScheduler background training — daily cron jobs for all 6 models (Revenue 2AM, Orders 2:15AM, Segmentation 2:30AM, Recommendations 2:45AM, Inventory 3AM, Wait Time hourly)
- [x] Model Registry — JSON-file-based metadata tracking (model_name, version, restaurant_id, training_rows, metrics, status: ACTIVE/TRAINING/FAILED/ARCHIVED)
- [x] Model Versioning — semantic versioning (v1, v2, v3...) with retention policy (keep latest 3, archive older)
- [x] Drift Detection — MAPE, RMSE, and prediction variance monitoring with configurable thresholds
- [x] Model Metrics API — `GET /api/v1/metrics/models` (totalModels, healthyModels, failedModels, averageAccuracy)
- [x] Model Health API — `GET /api/v1/models/health` (per-model health status, active/failed counts, version counts)
- [x] Manual Retraining — `POST /api/v1/models/retrain` triggers on-demand training for any model
- [x] Model Cleanup — keep latest 3 versions, archive older, delete stale Redis cache
- [x] Test suite — 5 new test modules (test_registry, test_drift_detection, test_model_health, test_scheduler, test_retraining)

### Milestone 5 ✅
- [x] Intent Classifier — keyword/pattern-based NLU for 8 intents (REVENUE, CUSTOMERS, FORECAST, INVENTORY, OPERATIONS, MENU, RECOMMENDATIONS, GENERAL) with weighted scoring
- [x] Context Builder — gathers analytics context from all M2/M3 services (revenue, dashboard, forecast, customers, recommendations, menu, operations, inventory) for prompt enrichment
- [x] Conversation Memory — Redis-backed per-restaurant conversation history with configurable max history and TTL
- [x] Explanation Engine — extracts structured explanations (reasons, trends, recommendations, summary) from AI responses
- [x] Prompt Templates — modular prompt builder with context injection, intent-aware system prompts, and conversation history formatting
- [x] Response Formatter — normalizes and sanitizes LLM output into structured ChatResponse
- [x] LLM Provider Abstraction — pluggable provider architecture with Mock (default), Gemini, OpenAI, and DeepSeek providers
- [x] Copilot Chat API — `POST /api/v1/copilot/chat` (natural language query with intent classification, context gathering, LLM response)
- [x] Copilot Stats API — `GET /api/v1/copilot/stats` (questions answered, average response time, active provider)
- [x] Test suite — 89 tests across 5 modules (test_copilot, test_intent_classifier, test_context_builder, test_memory, test_provider_factory)

## Milestone 6 ✅ (Current)
- [x] Anomaly Detection — Isolation Forest-based detection with Z-score fallback for small datasets; revenue, order, and inventory anomaly types
- [x] Trend Detection — week-over-week and month-over-month revenue trend analysis
- [x] Opportunity Detection — upsell opportunities (frequently-bought-together), peak period identification, high-value customer detection, menu optimization
- [x] Risk Detection — churn prediction (30-day inactivity, low ratings), stockout prediction (consumption rate), revenue decline (2+ consecutive weeks)
- [x] Insight Generator — orchestrates all detectors into DailyInsight and WeeklyReport structured reports
- [x] Notification Service — evaluates insight severity and dispatches via email (SMTP) and webhook (HMAC-SHA256)
- [x] In-Memory Insight History — `collections.deque`-based history with configurable max retention (500 entries)
- [x] Insight API — `GET /api/v1/insights/daily`, `GET /api/v1/insights/weekly`, `GET /api/v1/insights/history`
- [x] Scheduled Jobs — daily insight generation (8:00 AM IST) and weekly report generation (9:00 AM IST, Mondays)
- [x] Test suite — 57 tests across 4 modules (test_anomalies, test_risks, test_notifications, test_insights)

## Milestone 6 API Reference

### Proactive Insights

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/insights/daily` | GET | Daily AI-generated insights (anomalies, trends, opportunities, risks) |
| `/api/v1/insights/weekly` | GET | Comprehensive weekly AI report with summaries and recommendations |
| `/api/v1/insights/history` | GET | Recent insight history with pagination (limit param) |

### Insight Types

| Type | Description | Example |
|---|---|---|
| `anomaly` | Abnormal metric deviation detected | "Revenue is 35% below expected for today" |
| `trend` | Week-over-week or month-over-month trend | "Revenue up 12.5% vs last week" |
| `opportunity` | Growth or optimization opportunity | "Butter Chicken + Naan are frequently bought together" |
| `risk` | Predicted business risk | "Customer Alice has not ordered in 45 days" |

### Severity Levels

| Level | Threshold | Description |
|---|---|---|
| `critical` | > 30% deviation | Requires immediate attention |
| `high` | 15–30% deviation | Action needed within 24 hours |
| `medium` | 5–15% deviation | Monitor and plan |
| `low` | < 5% deviation | Informational |

### Response Fields

#### Daily Insight
```json
{
  "restaurant_id": "uuid",
  "date": "2025-06-18",
  "generated_at": "2025-06-18T08:00:00+05:30",
  "anomalies": [
    {
      "type": "revenue",
      "severity": "high",
      "metric": "daily_revenue",
      "current_value": 8500.00,
      "expected_value": 12500.00,
      "deviation_pct": 32.0,
      "detected_at": "2025-06-18T08:00:00+05:30",
      "description": "Revenue is 32% below expected"
    }
  ],
  "trends": [
    {
      "type": "revenue_wow",
      "severity": "medium",
      "metric": "weekly_revenue",
      "current_value": 87500.00,
      "previous_value": 82000.00,
      "change_pct": 6.7,
      "direction": "up",
      "description": "Revenue increased 6.7% vs last week"
    }
  ],
  "opportunities": [
    {
      "type": "upsell",
      "severity": "low",
      "category": "menu",
      "detail": "Butter Chicken + Naan",
      "recommendation": "Bundle these items for higher AOV",
      "detected_at": "2025-06-18T08:00:00+05:30"
    }
  ],
  "risks": [
    {
      "type": "churn_risk",
      "severity": "high",
      "category": "customer",
      "detail": "Customer Alice inactive for 45 days",
      "recommendation": "Send re-engagement offer",
      "probability": 0.75,
      "detected_at": "2025-06-18T08:00:00+05:30"
    }
  ],
  "summary": "1 high-severity anomaly detected. Revenue trending up 6.7% WoW.",
  "alert_count": 2
}
```

#### Weekly Report
```json
{
  "restaurant_id": "uuid",
  "week_start": "2025-06-09",
  "week_end": "2025-06-15",
  "generated_at": "2025-06-16T09:00:00+05:30",
  "revenue_summary": "Total revenue: ₹3,42,000. Up 8.3% vs last week.",
  "top_performers": ["Butter Chicken", "Naan", "Biryani"],
  "risk_summary": "2 customers at churn risk. 1 inventory item near stockout.",
  "trend_summary": "Revenue trending up. Order volume increased 5.2%.",
  "recommendations": [
    "Run a weekend promotion on Dal Makhani",
    "Reorder flour within 3 days"
  ],
  "anomalies": [...],
  "trends": [...],
  "opportunities": [...],
  "risks": [...]
}
```

#### Insight History
```json
{
  "restaurant_id": "uuid",
  "entries": [
    {
      "date": "2025-06-18",
      "type": "daily",
      "summary": "1 high-severity anomaly detected",
      "alert_count": 2,
      "generated_at": "2025-06-18T08:00:00+05:30"
    }
  ],
  "total": 42
}
```

### Notification Channels

| Channel | Configuration | Description |
|---|---|---|
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | HTML email with alert summary, severity badges, and recommendations |
| Webhook | `WEBHOOK_URL`, `WEBHOOK_SECRET` | JSON POST with HMAC-SHA256 signature header (`X-AuraOS-Signature`) |

### Notification Thresholds

| Setting | Default | Description |
|---|---|---|
| `NOTIFY_REVENUE_DROP_PCT` | 15.0 | % revenue drop triggering notification |
| `NOTIFY_WAIT_TIME_THRESHOLD_MINUTES` | 45.0 | Wait time threshold in minutes |
| `NOTIFY_INVENTORY_RISK_DAYS` | 3 | Days until depletion triggering inventory alert |
| `NOTIFY_ENABLED` | `false` | Master switch for notification delivery |

### Training Schedule (Updated)

| Model | Cron | Time (IST) |
|---|---|---|
| Revenue Forecast | `0 2 * * *` | 2:00 AM daily |
| Order Forecast | `15 2 * * *` | 2:15 AM daily |
| Customer Segmentation | `30 2 * * *` | 2:30 AM daily |
| Recommendation Engine | `45 2 * * *` | 2:45 AM daily |
| Wait Time Prediction | `0 * * * *` | Every hour |
| Inventory Prediction | `0 3 * * *` | 3:00 AM daily |
| **Daily Insights** | `0 8 * * *` | **8:00 AM daily** |
| **Weekly Report** | `0 9 * * 1` | **9:00 AM Mondays** |

## Milestone 2 API Reference

### Revenue Analytics

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/analytics/revenue/daily` | GET | Daily revenue with peak hours, top day/month |
| `/api/v1/analytics/revenue/weekly` | GET | Weekly revenue with growth percentages |
| `/api/v1/analytics/revenue/monthly` | GET | Monthly revenue with growth percentages |
| `/api/v1/analytics/revenue/yearly` | GET | Yearly revenue |
| `/api/v1/analytics/revenue/trends` | GET | Month-over-month growth trends |
| `/api/v1/analytics/revenue/peak-hours` | GET | Hourly order distribution |

### Dashboard

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/dashboard` | GET | Unified dashboard (KPIs, charts, top items) — cached 5 min |

### Top Items

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/analytics/top-items` | GET | Top items by revenue or quantity |
| `/api/v1/analytics/top-categories` | GET | Top categories by revenue |
| `/api/v1/analytics/frequently-bought-together` | GET | Co-occurring item pairs (SQL) |

### Response Fields

#### Daily Revenue
```json
{
  "date": "2025-06-18",
  "totalRevenue": 12500.00,
  "completedOrders": 42,
  "averageOrderValue": 297.62,
  "growthPercentage": 12.5,
  "peakHour": 19,
  "topDay": "Friday",
  "topMonth": "December"
}
```

#### Dashboard
```json
{
  "totalOrders": 55,
  "completedOrders": 42,
  "cancelledOrders": 3,
  "totalRevenue": 12500.00,
  "averageOrderValue": 297.62,
  "activeCustomers": 38,
  "repeatCustomers": 12,
  "peakHour": 19,
  "topSellingItem": {"name": "Butter Chicken", "quantitySold": 24},
  "hourlySales": {"labels": ["00:00", ...], "values": [0, ...]},
  "weeklySales": {"labels": ["2025-06-09", ...], "values": [85000, ...]},
  "monthlySales": {"labels": ["2025-01", ...], "values": [340000, ...]},
  "topItems": [{"itemName": "Butter Chicken", "quantitySold": 24, "revenue": 7200, "profit": null, "categoryName": "Main Course"}],
  "generatedAt": "2025-06-18T14:30:00+00:00"
}
```

#### Frequently Bought Together
```json
[
  {"itemA": "Burger", "itemB": "French Fries", "frequency": 120},
  {"itemA": "Naan", "itemB": "Butter Chicken", "frequency": 95}
]
```

## Milestone 3 API Reference

### Forecasting

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/forecast/revenue` | GET | Revenue forecast for next N days (Prophet) |
| `/api/v1/forecast/orders` | GET | Order count forecast for next N days (Prophet) |

### Customers

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/customers/segments` | GET | Customer segments (VIP/Loyal/Regular/At Risk/Lost) |

### Recommendations

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/recommendations/items` | GET | Item recommendations based on association rules |

### Prediction

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/predict/wait-time` | GET | Estimated food preparation wait time (XGBoost) |
| `/api/v1/predict/inventory` | GET | Inventory depletion dates and reorder recommendations |

### Response Fields

#### Revenue Forecast
```json
{
  "forecast": [
    {"date": "2025-06-19", "revenue": 12500.00, "lowerBound": 11000.00, "upperBound": 14000.00}
  ],
  "trend": "upward",
  "growthPercentage": 12.3,
  "confidence": 0.91
}
```

#### Customer Segment
```json
{
  "customerId": "uuid",
  "name": "John Doe",
  "segment": "VIP",
  "recencyDays": 3,
  "frequency": 42,
  "monetary": 12500.00,
  "totalSpent": 12500.00
}
```

#### Recommendation
```json
{
  "itemId": "uuid",
  "itemName": "Coke",
  "confidence": 0.75,
  "support": 0.20
}
```

#### Wait Time Estimate
```json
{
  "estimatedWaitMinutes": 15.5,
  "confidence": 0.85,
  "factors": {
    "activeOrders": 8,
    "tableOccupancy": 0.65,
    "kitchenLoad": 16
  },
  "generatedAt": "2025-06-18T14:30:00+00:00"
}
```

#### Inventory Prediction
```json
{
  "itemId": "uuid",
  "name": "Flour",
  "unit": "kg",
  "currentStock": 25.0,
  "dailyRate": 2.5,
  "depletionDate": "2025-06-28",
  "daysRemaining": 10.0,
  "reorderDate": "2025-06-25",
  "reorderQuantity": 10.0,
  "needsReorder": false
}
```

## Milestone 4 API Reference

### Model Metrics & Health

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/metrics/models` | GET | Aggregate model metrics (total, healthy, failed, accuracy) |
| `/api/v1/models/health` | GET | Per-model health status with version counts |
| `/api/v1/models/retrain` | POST | Trigger manual retraining for a specific model |

### Response Fields

#### Model Metrics
```json
{
  "totalModels": 6,
  "healthyModels": 5,
  "failedModels": 1,
  "averageAccuracy": 0.87,
  "models": {
    "revenue_forecast": {"status": "ACTIVE", "version": "v3", "accuracy": 0.91},
    "order_forecast": {"status": "ACTIVE", "version": "v2", "accuracy": 0.89}
  }
}
```

#### Model Health
```json
{
  "models": {
    "revenue_forecast": {
      "status": "HEALTHY",
      "active_count": 1,
      "failed_count": 0,
      "total_versions": 3
    },
    "order_forecast": {
      "status": "UNHEALTHY",
      "active_count": 1,
      "failed_count": 2,
      "total_versions": 4
    }
  }
}
```

#### Retrain Response
```json
{
  "status": "started",
  "model": "revenue_forecast",
  "message": "Retraining job triggered for revenue_forecast"
}
```

### Training Schedule

| Model | Cron | Time (IST) |
|---|---|---|
| Revenue Forecast | `0 2 * * *` | 2:00 AM daily |
| Order Forecast | `15 2 * * *` | 2:15 AM daily |
| Customer Segmentation | `30 2 * * *` | 2:30 AM daily |
| Recommendation Engine | `45 2 * * *` | 2:45 AM daily |
| Wait Time Prediction | `0 * * * *` | Every hour |
| Inventory Prediction | `0 3 * * *` | 3:00 AM daily |

### Drift Detection Thresholds

| Metric | Threshold | Description |
|---|---|---|
| MAPE | > 0.20 (20%) | Mean Absolute Percentage Error |
| RMSE | > 2× baseline | Root Mean Square Error vs historical baseline |
| Variance | > 0.30 (30%) | Prediction variance instability |

## Milestone 5 API Reference

### AI Copilot

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/copilot/chat` | POST | Natural language business intelligence query |
| `/api/v1/copilot/stats` | GET | Copilot usage statistics (questions answered, avg response time, provider) |

### Intent Classification

The intent classifier detects 8 intents from natural language:

| Intent | Example Query |
|---|---|
| REVENUE | "How much revenue did we make last week?" |
| CUSTOMERS | "Who are my VIP customers?" |
| FORECAST | "What will sales look like next month?" |
| INVENTORY | "When will we run out of flour?" |
| OPERATIONS | "How long is the wait time right now?" |
| MENU | "What's our best-selling item?" |
| RECOMMENDATIONS | "What should I recommend with Butter Chicken?" |
| GENERAL | "Hello" or "How's business?" |

### LLM Providers

| Provider | Setting | Description |
|---|---|---|
| Mock | Default | Returns pre-built responses; no API key needed |
| Gemini | `LLM_PROVIDER=gemini` | Google Gemini via `GOOGLE_API_KEY` |
| OpenAI | `LLM_PROVIDER=openai` | OpenAI GPT via `OPENAI_API_KEY` |
| DeepSeek | `LLM_PROVIDER=deepseek` | DeepSeek via `DEEPSEEK_API_KEY` |

### Response Fields

#### Chat Request
```json
{
  "message": "What were our top selling items this week?"
}
```

#### Chat Response
```json
{
  "answer": "Your top selling item this week was Butter Chicken with 24 orders...",
  "sources": ["revenue", "top_items"],
  "confidence": 0.85,
  "explanation": {
    "reasons": ["Butter Chicken is a customer favorite"],
    "trends": ["Sales increased 12% week-over-week"],
    "recommendations": ["Consider promoting Naans as a combo"],
    "summary": "Butter Chicken leads sales at 24 orders"
  },
  "intent": "MENU",
  "provider": "mock",
  "response_time_ms": 42
}
```

#### Copilot Stats
```json
{
  "questionsAnswered": 156,
  "averageResponseTime": 45.2,
  "provider": "mock"
}
```

## License

Proprietary — AuraOS. All rights reserved.