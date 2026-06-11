# 🍽️ AuraOS — Restaurant Management Platform

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Node.js-18-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 18" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 15" />
  <img src="https://img.shields.io/badge/Socket.io-4-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</p>

<p align="center">
  <b>A multi-tenant restaurant POS platform supporting 6 restaurant types with real-time kitchen display, QR ordering, WhatsApp & Zomato integrations, and inventory management.</b>
</p>

---

## 📑 Table of Contents

- [✨ Highlights](#-highlights)
- [🚀 Demo](#-demo)
- [📖 Overview](#-overview)
- [⚙️ Features](#️-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📸 Screenshots](#-screenshots)
- [💻 Installation](#-installation)
- [🗄️ Database](#️-database)
- [📁 Project Structure](#-project-structure)
- [🧠 Key Design Decisions](#-key-design-decisions)
- [🚧 Future Improvements](#-future-improvements)
- [📄 License](#-license)

---

## ✨ Highlights

| | | |
|---|---|---|
| 🏢 **Multi-tenant architecture** | 🏷️ **6 restaurant types** | ⚡ **Real-time updates (Socket.io)** |
| 📱 **QR ordering** | 🖥️ **Kitchen Display System** | 🔢 **Customer Token Display** |
| 📦 **Inventory management** | 💰 **Payment collection** | 🔐 **Role-based access control** |
| 🛡️ **Super Admin platform** | 🐳 **Docker support** | |

---

## 🚀 Demo

### Live Endpoints

| Service | URL | Auth |
|---------|-----|------|
| **Staff Portal** | http://localhost:3001 | Login |
| **Backend API** | http://localhost:3000/api/v1 | JWT |
| **Customer Ordering** | http://localhost:3001/customer?slug=demo-kitchen | Public |
| **Health Endpoint** | http://localhost:3000/api/v1/health | Public |

### Demo Credentials

```
Email:    admin@demo-kitchen.local
Password: demo123
```

> Run `npm run migrate` to seed the demo restaurant with sample data.

---

## 📖 Overview

AuraOS is a **multi-tenant Point of Sale system** built for restaurants of every shape and size. A single superadmin can manage multiple restaurants, each with its own menu, tables, staff, features, and subscription plan — all from one dashboard.

### Six Restaurant Types, One Platform

| Type | Description | Best For |
|------|-------------|----------|
| 🍽️ **Full Service** | Table service, waiters, QR ordering, full menu | Fine dining, family restaurants |
| 🍔 **QSR Simple** | Counter-ordering, quick turnaround, kitchen display | Fast-food, single-location quick-service |
| 🏢 **QSR Chain** | Multi-outlet QSR with centralized management | Franchises, chain restaurants |
| ☕ **Café** | Light menu, QR ordering, no waiter app | Coffee shops, bakeries, casual cafés |
| 🏭 **Cloud Kitchen** | Delivery-only, no dine-in, Zomato integration | Ghost kitchens, delivery brands |
| 🔀 **Hybrid** | Mix of dine-in + delivery + takeaway | Modern restaurants, food courts |

Each type pre-configures the right feature flags, dashboard cards, and navigation items — so restaurants only see what they need.

---

## ⚙️ Features

### 🔐 Authentication

- JWT access tokens (15 min) + refresh tokens (7 days) with automatic renewal
- bcryptjs password hashing
- Zod schema validation on all inputs
- Rate limiting on login and registration endpoints
- Password reset flow with email tokens

### 📋 Orders

- Create and manage orders with a slide-over cart panel
- Supports **Dine-In**, **Parcel**, and **Online** order types
- Order status pipeline: `RECEIVED → PREPARING → READY → COMPLETED`
- Running tabs — active orders persist on tables until paid
- Auto-incrementing daily token numbers for parcel/pickup orders
- Programmatic KOT and receipt printing via `window.print()`

### 🪑 Tables

- Visual floor plan with grid/column layout of sections and tables
- Color-coded table states: Available, Occupied, Reserved, Maintenance
- Click any table to view the running order, add items, or collect payment
- Generate and print QR codes per table

### 🖥️ Kitchen Display

- Real-time order board via Socket.io — orders appear as they're placed
- Sort by wait time or priority
- Mark individual items as done; order auto-completes when all items are ready
- Delay alerts when orders exceed preparation thresholds
- Full-screen mode for dedicated kitchen monitors

### 📱 QR Ordering

- Customers scan a QR code, browse the menu, and place orders — no login needed
- Restaurant slug system (`/customer?slug=restaurant-name`)
- Orders automatically linked to the correct table
- WhatsApp share for takeaway/pre-order scenarios

### 💰 Payments

- Cash, UPI, Card, and Razorpay online payments
- Collect full or partial payments against running orders
- Filterable transaction history (Paid, Pending, Refunded)
- Razorpay webhook receiver for automated payment confirmation

### 📦 Inventory

- Track ingredients and supplies with unit, quantity, and reorder thresholds
- Low-stock alerts on the dashboard
- Full audit trail of stock adjustments with reason tracking
- Background job syncs inventory every 60 seconds

### 📊 Reports

- Area chart showing daily revenue trends (7/14/30 day views)
- Bar chart of best-selling items by quantity
- Pie chart of sales by category distribution
- Key metrics: today's revenue, total orders, average order value, active tables

### 👥 Users & Roles

- 6 roles: Super Admin, Admin, Manager, Staff, Waiter, Kitchen
- Add, edit, deactivate staff accounts per restaurant
- Sidebar navigation dynamically filtered by role and restaurant features

### 🧂 Modifiers

- Modifier groups: toppings, add-ons, spice levels
- Attach groups to menu items with optional/min/max selection rules
- Section organization for menus (e.g., "Breakfast Menu", "Lunch Menu")

### 🏷️ Restaurant Types

- Centralized type definitions in [`restaurantTypes.ts`](client/src/config/restaurantTypes.ts)
- Per-type configs: nav visibility, dashboard cards, setup wizard steps, default features
- Selecting a type during creation auto-sets sensible feature defaults

### 🛡️ Super Admin

- Multi-tenant dashboard — view all restaurants, status, and metrics
- Create new restaurants with type selection, feature presets, and admin account
- Toggle individual features per restaurant (8 toggleable features)
- Suspend and reactivate restaurant accounts
- Organization groups for chain/franchise management with aggregate metrics
- Built-in support ticket system and contact inquiry management

### 📈 Monitoring

- Real-time system health, uptime, memory, and active connections
- Error log with stack traces and request context
- Health check endpoints: `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`
- Optional Sentry integration for production error tracking

### 📞 Book Demo Flow

- Public landing page with restaurant type showcase, pricing tiers, FAQ, and contact form
- Self-registration onboarding flow for restaurant owners
- Contact inquiries with status tracking in the superadmin dashboard

---

## 🏗️ Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (Ports 3001 & 3002)"]
        SP[Staff Portal<br/>React 18 + Vite]
        WA[Waiter App<br/>React PWA]
        CUST[Customer QR Ordering<br/>React Page]
    end

    subgraph Backend["Backend (Port 3000)"]
        API[REST API<br/>Express 4]
        WS[WebSocket<br/>Socket.io 4]
        JOBS[Background Jobs<br/>Delay Detector + Inventory Sync]
        MON[Monitoring<br/>Health + Metrics + Errors]
    end

    subgraph Integrations["External Integrations"]
        ZOM[Zomato Webhook]
        WAPP[WhatsApp Webhook]
        RZP[Razorpay Webhook]
        EMAIL[SMTP Email]
    end

    subgraph Data["Data Layer"]
        DB[(PostgreSQL 15)]
    end

    SP -->|Axios| API
    WA -->|Axios| API
    CUST -->|Axios| API
    SP -->|Socket.io| WS
    WA -->|Socket.io| WS

    ZOM -->|Webhook| API
    WAPP -->|Webhook| API
    RZP -->|Webhook| API
    API -->|Nodemailer| EMAIL

    API --> DB
    JOBS --> DB
    WS -->|Event Push| SP
    WS -->|Event Push| WA
```

### Layered Architecture (Frontend → Database)

```mermaid
graph TD
    subgraph Frontend["Frontend"]
        REACT[React Component]
        CTX[Context / Hooks]
        AX[Axios Client]
    end

    subgraph Backend["Backend"]
        direction TB
        ROUTE[Route Layer<br/>Validation + Auth Middleware]
        CTRL[Controller<br/>Request/Response Handling]
        SVC[Service Layer<br/>Business Logic]
        REPO[Repository Layer<br/>Raw SQL Queries]
    end

    DB[(PostgreSQL)]

    REACT --> CTX --> AX
    AX -->|HTTP Request| ROUTE
    ROUTE -->|Validated| CTRL
    CTRL -->|Delegates| SVC
    SVC -->|Queries| REPO
    REPO -->|pg Pool| DB
    DB -->|Result Rows| REPO
    REPO -->|Typed Entities| SVC
    SVC -->|Domain Objects| CTRL
    CTRL -->|JSON Response| AX
    AX -->|Response Data| CTX -->|State Update| REACT
```

### JWT Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant DB

    Client->>Server: POST /api/v1/auth/login { email, password }
    Server->>DB: SELECT user WHERE email
    DB-->>Server: User row (hashed password)
    Server->>Server: bcrypt.compare(password, hash)
    Server->>Server: Generate JWT (15min) + Refresh Token (7d)
    Server-->>Client: { token, refreshToken, user }

    Note over Client,Server: Token expires after 15 minutes

    Client->>Server: POST /api/v1/auth/refresh { refreshToken }
    Server->>DB: Verify refresh token
    Server->>Server: Generate new JWT + Refresh Token
    Server-->>Client: { token, refreshToken }
```

### Real-time Kitchen Order Flow (Socket.io)

```mermaid
sequenceDiagram
    participant Staff as Staff POS
    participant Server as Backend
    participant Kitchen as Kitchen Display

    Staff->>Server: POST /api/v1/orders { items, table_id }
    Server->>Server: Validate, create order, insert items
    Server->>Server: Broadcast 'ORDER_CREATED'
    Server-->>Kitchen: Socket.io → ORDER_CREATED
    Kitchen->>Kitchen: Add order to display board

    Kitchen->>Server: PATCH /api/v1/orders/:id/items/:itemId/status
    Server->>Server: Update item status, check if all done
    Server->>Server: Broadcast 'ORDER_ITEM_STATUS'
    Server-->>Staff: Socket.io → ORDER_ITEM_STATUS

    Server->>Server: All items done → auto-set order to READY
    Server->>Server: Broadcast 'ORDER_STATUS_CHANGED'
    Server-->>Staff: Socket.io → ORDER_STATUS_CHANGED
    Server-->>Kitchen: Socket.io → ORDER_STATUS_CHANGED
```

### Multi-Tenant Architecture

```mermaid
graph TB
    SA[Super Admin] -->|Manages| ALL[All Restaurants]
    ALL --> R1[Restaurant A<br/>Full Service]
    ALL --> R2[Restaurant B<br/>QSR Chain]
    ALL --> R3[Restaurant C<br/>Cloud Kitchen]

    R1 --> U1[Admin A]
    R2 --> U2[Admin B]
    R3 --> U3[Admin C]

    R1 --> F1[Features: Kitchen, QR, Waiter, ...]
    R2 --> F2[Features: Kitchen, Inventory, Chain, ...]
    R3 --> F3[Features: Kitchen, Zomato, ...]

    U1 -->|Scoped to| R1
    U2 -->|Scoped to| R2
    U3 -->|Scoped to| R3

    SA -->|Organization Groups| OG[Franchise Group]
    OG --> R2
    OG --> R4[Restaurant D<br/>Same Chain]
```

---

## 🛠️ Tech Stack

### Backend

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js 18+ | JavaScript runtime |
| Language | TypeScript (strict) | Type safety |
| Framework | Express 4 | HTTP server, routing, middleware |
| Database | PostgreSQL 15 | Relational data store |
| Query | `pg` (raw SQL) | Parameterized queries, no ORM |
| Auth | JWT + bcryptjs | Access/refresh tokens, password hashing |
| Validation | Zod | Schema-based input validation |
| Real-time | Socket.io 4 | WebSocket push to kitchen/client |
| Payments | Razorpay | Payment gateway |
| Email | Nodemailer | Transactional emails |
| Rate Limiting | express-rate-limit | API abuse prevention |
| Security | Helmet, CORS | HTTP security headers, cross-origin |
| Logging | Morgan | HTTP request logging |
| Testing | Jest + Supertest | Unit and integration tests |
| Container | Docker Compose | PostgreSQL database container |

### Frontend

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React 18 | UI component library |
| Build | Vite | Fast dev server and bundler |
| Language | TypeScript (strict) | Type safety |
| Styling | Tailwind CSS 3 | Utility-first CSS framework |
| Charts | Recharts | Revenue, top items, pie charts |
| Routing | React Router v6 | Client-side routing |
| HTTP | Axios | API client with interceptors |
| WebSocket | Socket.io Client | Real-time order updates |
| Notifications | react-hot-toast | Toast notifications |
| UI Primitives | @headlessui/react | Accessible modals, transitions |
| Icons | @heroicons/react + lucide-react | SVG icon libraries |
| Date | date-fns | Date formatting and math |
| PWA | vite-plugin-pwa + Workbox | Service worker, offline support |
| Testing | Vitest + Testing Library | Component and hook tests |

---

## 📸 Screenshots

> Screenshots are stored in [`docs/screenshots/`](docs/screenshots/). See [`docs/screenshots/README.md`](docs/screenshots/README.md) for capture instructions.

### 🌐 Public Pages

| Landing Page |
|-------------|
| ![Landing Page](docs/screenshots/landing-page.png) |
| *Marketing landing page with restaurant type showcase, pricing tiers, FAQ, and contact form* |

### 📊 Staff Portal

| Dashboard | Orders |
|-----------|--------|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Orders](docs/screenshots/orders.png) |
| *Revenue charts, metrics cards, setup wizard, and quick actions* | *Order management with status tabs, filtering, and slide-over cart* |

| Tables | Kitchen Display |
|--------|-----------------|
| ![Tables](docs/screenshots/tables.png) | ![Kitchen Display](docs/screenshots/kitchen-display.png) |
| *Visual floor plan with color-coded table states and QR code generation* | *Real-time order board with status controls, delay alerts, and full-screen mode* |

| Reports | Menu |
|---------|------|
| ![Reports](docs/screenshots/reports.png) | ![Menu](docs/screenshots/menu.png) |
| *Revenue trends, top-selling items, category distribution with interactive charts* | *Category and item management with pricing, modifiers, and availability toggles* |

---

## 💻 Installation

### Prerequisites

| Tool | Version | Check | Notes |
|------|---------|-------|-------|
| Node.js | 18+ | `node -v` | Runtime for all services |
| npm | 9+ | `npm -v` | Comes with Node.js |
| PostgreSQL | 14+ | `psql --version` | Or use Docker (see below) |

### Quick Start with Docker

```bash
# Start PostgreSQL
docker compose up -d
```

Creates a PostgreSQL 15 container: database `auraos`, user `auraos_user`, password `auraos_password`, port `5432`.

### 1. Clone & Install

```bash
git clone https://github.com/your-org/auraos.git
cd auraos

# Install backend dependencies
npm install

# Install staff portal dependencies
cd client && npm install && cd ..

# Install waiter app dependencies
cd apps/waiter && npm install && cd ../..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with the minimum required values:

```ini
DATABASE_URL=postgresql://auraos_user:auraos_password@localhost:5432/auraos
JWT_SECRET=your_random_secret_at_least_32_characters_long
JWT_REFRESH_SECRET=another_random_secret_at_least_32_characters
FRONTEND_URL=http://localhost:3001
```

> Razorpay, WhatsApp, Zomato, SMTP, and Sentry are **optional** — defaults use cash-only payments, console email, and console monitoring.

### 3. Run Migrations

```bash
npm run migrate
```

Seeds a demo restaurant with sample data.

### 4. Start the Services

Open **3 terminals**:

| Terminal | Command | Port | What |
|----------|---------|------|------|
| 1 (root) | `npm run dev` | 3000 | Backend API + Socket.io + Background Jobs |
| 2 (`client/`) | `npm run dev` | 3001 | Staff Portal (React PWA) |
| 3 (`apps/waiter/`) | `npm run dev` | 3002 | Waiter App (React PWA) |

### URLs

| Service | URL | Auth |
|---------|-----|------|
| Backend API | http://localhost:3000/api/v1 | JWT |
| Health Check | http://localhost:3000/api/v1/health | Public |
| Staff Portal | http://localhost:3001 | Login |
| Kitchen Display | http://localhost:3001/kitchen | Login |
| Customer QR Ordering | http://localhost:3001/customer?slug=demo-kitchen | Public |
| Waiter App | http://localhost:3002 | Login |

### Running Tests

```bash
# Backend tests
npm test

# Frontend tests
cd client && npm test
```

---

## 🗄️ Database

AuraOS uses **raw SQL with parameterized queries** via the `pg` driver — no ORM. All queries are hand-written in the repository layer.

### Migration History

| # | File | Purpose |
|---|------|---------|
| 001 | `001_enums.sql` | Custom PostgreSQL enum types (order status, payment methods, user roles, restaurant types) |
| 002 | `002_core.sql` | Core tables: users, restaurants, tables, sections |
| 003 | `003_menu.sql` | Menu categories, items, and pricing |
| 004 | `004_orders.sql` | Orders, order items, order status tracking |
| 005 | `005_supporting.sql` | Payments, inventory items, inventory transactions |
| 006 | `006_seed.sql` | Demo data: restaurant, admin user, sample menu, tables |
| 007 | `007_qr_mode.sql` | QR ordering mode and public menu endpoints |
| 008 | `008_password_reset.sql` | Password reset tokens and flow |
| 009 | `009_inventory_history.sql` | Inventory adjustment history with reason tracking |
| 010 | `010_zomato_mapping.sql` | Zomato order mapping and webhook storage |
| 011 | `011_subscriptions.sql` | Subscription plans, invoices, and billing |
| 012 | `012_restaurant_features.sql` | Feature flags per restaurant (8 toggleable features) |
| 013 | `013_missing_indexes.sql` | Performance indexes on high-traffic columns |
| 014 | `014_admin_inquiries_support.sql` | Contact inquiries and support ticket system |
| 015 | `015_refresh_tokens.sql` | Refresh token storage and rotation |
| 016 | `016_restaurant_gst.sql` | GST number and tax configuration per restaurant |
| 017 | `017_restaurant_type_qsr_sections.sql` | Menu sections for QSR and Full Service types |
| 018 | `018_orders_token_number.sql` | Daily auto-incrementing token numbers for orders |
| 019 | `019_modifiers.sql` | Modifier groups, options, and order item modifiers |
| 020 | `020_organization_groups.sql` | Multi-outlet organization groups for chain management |

### Key Schema Decisions

- **No ORM** — Every query is hand-written SQL for full control over query plans and performance
- **Parameterized Queries** — All user input uses `$1, $2, ...` placeholders, eliminating SQL injection
- **Repository Pattern** — Each module has a dedicated repository class encapsulating all database access
- **Enum Types** — PostgreSQL native enums for order status, payment methods, user roles, and restaurant types
- **Foreign Keys** — All relationships enforced with FK constraints and cascading deletes
- **Indexes** — Strategic indexes on `restaurant_id`, `status`, `created_at`, and FK columns

---

## 📁 Project Structure

<details>
<summary><b>📂 Backend — <code>src/</code></b></summary>

```
src/
├── app.ts                        # Express app setup, middleware, route mounting
├── server.ts                     # HTTP server, Socket.io init, graceful shutdown
├── config/
│   ├── database.ts               # PostgreSQL pool (pg, max 20 connections)
│   ├── env.ts                    # Environment variable validation (Zod)
│   ├── email.ts                  # Nodemailer transport configuration
│   └── payments.ts               # Payment gateway config (Razorpay)
├── modules/
│   ├── admin/                    # Superadmin routes (create restaurant, inquiries, tickets)
│   ├── auth/                     # Login, register, JWT, refresh tokens
│   ├── restaurants/              # Restaurant CRUD, sections, features, stats
│   ├── tables/                   # Table management, sections, status
│   ├── menu/                     # Categories, items, availability
│   ├── modifiers/                # Modifier groups, options, attachment to items
│   ├── orders/                   # Order lifecycle, items, status pipeline
│   ├── payments/                 # Payment recording, gateway integration, webhooks
│   ├── inventory/                # Stock tracking, adjustments, history
│   ├── reports/                  # Revenue, top items, category distribution
│   ├── users/                    # Staff management, roles
│   ├── onboarding/               # Restaurant self-registration flow
│   ├── subscriptions/            # Plans, invoices, billing
│   ├── organizations/            # Multi-outlet groups for chain management
│   └── public/                   # Public endpoints (QR ordering, no auth)
├── integrations/
│   ├── zomato/                   # Zomato webhook receiver, order mapping
│   └── whatsapp/                 # WhatsApp Business API webhook, order parsing
└── shared/
    ├── errors/                   # AppError, NotFoundError, ValidationError classes
    ├── middleware/                # authenticate, authorize, errorHandler, rateLimiter
    ├── jobs/                     # Background jobs (delay detector, inventory sync)
    └── monitoring/               # Health checks, metrics, error capture
```

</details>

<details>
<summary><b>📂 Frontend — <code>client/src/</code></b></summary>

```
client/src/
├── pages/
│   ├── Dashboard.tsx             # Revenue charts, metrics, setup wizard
│   ├── Orders.tsx                # Order management with tabs
│   ├── Tables.tsx                # Table floor plan and status management
│   ├── Kitchen.tsx               # Kitchen display system
│   ├── Menu.tsx                  # Menu categories and items CRUD
│   ├── Payments.tsx              # Payment history and collection
│   ├── Inventory.tsx             # Inventory tracking and adjustments
│   ├── Reports.tsx               # Analytics dashboard with charts
│   ├── Users.tsx                 # Staff management
│   ├── Features.tsx              # Feature flag toggles
│   ├── QRSettings.tsx            # QR code generation and settings
│   ├── OwnerDashboard.tsx        # Superadmin multi-tenant dashboard
│   ├── MultiOutlet.tsx           # Organization group management
│   ├── Monitoring.tsx            # System health and error monitoring
│   ├── Onboarding.tsx            # Restaurant self-registration
│   ├── LandingPage.tsx           # Public landing/marketing page
│   ├── Login.tsx                 # Authentication
│   ├── CustomerApp.tsx           # Customer QR ordering page
│   └── NotFound.tsx              # 404 page
├── components/
│   ├── Layout.tsx                # App shell with sidebar navigation
│   ├── OrderForm.tsx             # Order creation/editing slide-over
│   ├── AddItemsModal.tsx         # Add items to existing order
│   ├── PaymentForm.tsx           # Payment collection modal
│   ├── PrintKOT.tsx              # Kitchen order ticket printer
│   ├── PrintReceipt.tsx          # Customer receipt printer
│   ├── Modal.tsx                 # Reusable modal component
│   ├── ErrorBoundary.tsx         # React error boundary
│   ├── ProtectedRoute.tsx        # Auth + role + superadmin route guard
│   ├── SetupWizard.tsx           # Step-by-step onboarding wizard
│   └── TableOrderPanel.tsx       # Table-level order management panel
├── contexts/
│   ├── AuthContext.tsx           # Auth state, login/logout, token refresh
│   ├── FeaturesContext.tsx       # Feature flags, restaurant type, nav filtering
│   └── SocketContext.tsx         # Socket.io connection management
├── config/
│   └── restaurantTypes.ts        # Type definitions, defaults, nav visibility, wizard steps
└── lib/
    └── utils.ts                  # Shared utility functions
```

</details>

<details>
<summary><b>📂 Other Directories</b></summary>

```
├── apps/waiter/                  # Waiter App (React PWA, standalone)
│   ├── src/api/                  # API client and endpoints
│   └── ...
├── migrations/                   # SQL migration files (001-020)
├── scripts/                      # Utility scripts
│   ├── migrate.ts                # Migration runner
│   ├── backup-db.ts              # Database backup
│   ├── restore-db.ts             # Database restore
│   ├── create-super-admin.ts     # CLI superadmin creation
│   └── ...
├── backups/                      # Database backup files
├── docker-compose.yml            # PostgreSQL container
├── .env.example                  # Environment template
├── package.json                  # Backend dependencies and scripts
└── jest.config.js                # Backend test configuration
```

</details>

---

## 🧠 Key Design Decisions

### 1. Raw SQL, No ORM

Every database query is hand-written SQL with parameterized placeholders. This gives full control over query structure, joins, and indexes — no N+1 surprises from lazy-loading ORMs, no migration framework, no query builder DSL. Just SQL files and the `pg` driver.

### 2. Repository Pattern

Each module follows a strict three-layer architecture:

```
Route → Controller → Service → Repository → PostgreSQL
```

- **Routes** — Define endpoints, apply middleware (auth, validation, rate limiting)
- **Controllers** — Parse request, call service, format response
- **Services** — Business logic, validation, orchestration
- **Repositories** — Raw SQL queries, return typed entities

Business logic is testable without a database, and SQL changes don't leak into route handlers.

### 3. Feature Flags, Not Code Branches

Instead of `if (restaurant.type === 'FULL_SERVICE')` scattered throughout the codebase, features are toggleable flags. Navigation items, dashboard cards, and setup wizard steps are filtered by these flags. Selecting a restaurant type during creation auto-sets sensible defaults.

### 4. JWT + Refresh Token Authentication

- **Access Token** — 15-minute expiry, sent in `Authorization: Bearer` header
- **Refresh Token** — 7-day expiry, stored in database, used to get new access tokens
- **Auto-Refresh** — The Axios interceptor detects 401 responses and automatically refreshes the token before retrying
- **Role Guards** — `ProtectedRoute` checks `user.role` and `user.isSuperAdmin` before rendering protected pages

### 5. Socket.io for Real-Time Kitchen

Orders placed by staff appear instantly on the kitchen display without polling:

- `ORDER_CREATED` — New order appears on the board
- `ORDER_STATUS_CHANGED` — Order moves through RECEIVED → PREPARING → READY → COMPLETED
- `ORDER_ITEM_STATUS` — Individual item marked done/undone
- `ORDER_DELAYED` — Visual alert when order exceeds preparation threshold

### 6. Programmatic Printing

KOT (Kitchen Order Tickets) and receipts are printed via `window.print()` with `@media print` CSS. No external print libraries or browser extensions needed.

### 7. Multi-App Monorepo

Three separate applications share the same backend, each with its own `package.json`, `tsconfig.json`, and `vite.config.ts`:

| App | Directory | Port |
|-----|-----------|------|
| Staff Portal | `client/` | 3001 |
| Waiter App | `apps/waiter/` | 3002 |
| Backend API | `src/` | 3000 |

### 8. Restaurant Type System

Six restaurant types are defined in [`restaurantTypes.ts`](client/src/config/restaurantTypes.ts) with associated configs: `NAV_TYPE_VISIBILITY`, `DASHBOARD_CARDS_BY_TYPE`, `SETUP_WIZARD_STEPS`, and `DEFAULT_FEATURES_BY_TYPE`. This centralizes type-specific behavior in one config file instead of spreading conditionals across pages.

---

## 🚧 Future Improvements

- [ ] **Loyalty Program** — Points-based customer loyalty with rewards and redemption
- [ ] **Customer Profiles** — Order history, preferences, and saved payment methods per customer
- [ ] **Reservations** — Table booking with time slots, capacity management, and confirmation flow
- [ ] **Swiggy Integration** — Webhook receiver for Swiggy order push into the POS
- [ ] **AI Copilot** — Smart menu suggestions, demand forecasting, and inventory optimization
- [ ] **Mobile App** — Native iOS and Android apps for staff and customers
- [ ] **CI/CD Pipeline** — Automated testing, linting, and deployment via GitHub Actions

---

## 📄 License

MIT License

Copyright (c) 2025 AuraOS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
