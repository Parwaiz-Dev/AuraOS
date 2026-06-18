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
         ├──► Redis (cache + Celery broker)
         └──► Joblib (trained model storage)
```

## Features

| Feature | Endpoints | ML Engine |
|---|---|---|
| Revenue Analytics | `/analytics/revenue/*` | Pandas + NumPy |
| Top Selling Items | `/analytics/top-items` | Frequent Itemset Mining |
| Customer Analytics | `/customers/*` | KMeans Clustering |
| Demand Forecasting | `/forecast/*` | Prophet |
| Inventory Prediction | `/inventory/*` | LightGBM |
| Wait Time Prediction | `/wait-time` | RandomForest |
| Recommendation Engine | `/recommendations` | Collaborative Filtering |
| Dashboard | `/dashboard` | Aggregation |
| Health Score | `/health-score` | Weighted Scoring |
| AI Insights | `/insights` | Rule-based NLG |

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

### Milestone 2 ✅ (Current)
- [x] Revenue analytics endpoints (`/analytics/revenue/daily`, `/weekly`, `/monthly`, `/yearly`, `/trends`, `/peak-hours`)
- [x] Top items / categories (`/analytics/top-items`, `/analytics/top-categories`)
- [x] Frequently bought together (`/analytics/frequently-bought-together`) — SQL-only aggregation
- [x] Dashboard KPIs (`/dashboard`) — Redis-cached (TTL 300s)
- [x] Repository / Service / Router layer architecture
- [x] Test suite (42 tests across 3 modules)

### Milestone 3
- [ ] Customer analytics (segmentation, LTV, churn)
- [ ] Forecasting with Prophet

### Milestone 4
- [ ] Inventory prediction
- [ ] Wait time prediction
- [ ] Recommendation engine

### Milestone 5
- [ ] Health score
- [ ] AI Insights
- [ ] Celery background training
- [ ] Model versioning

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

## License

Proprietary — AuraOS. All rights reserved.