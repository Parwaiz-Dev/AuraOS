# AuraOS — Complete Guide
**Last Updated:** May 2026  
**Status:** Production Ready

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [How to Run](#4-how-to-run)
5. [Database Schema](#5-database-schema)
6. [All API Endpoints](#6-all-api-endpoints)
7. [Order Workflows](#7-order-workflows)
8. [Real-time Events (Socket.io)](#8-real-time-events-socketio)
9. [QR Ordering System](#9-qr-ordering-system)
10. [WhatsApp Integration](#10-whatsapp-integration)
11. [Zomato Integration](#11-zomato-integration)
12. [Payment Gateways](#12-payment-gateways)
13. [PWA — Waiter App](#13-pwa--waiter-app)
14. [Frontend Pages](#14-frontend-pages)
15. [User Roles & Permissions](#15-user-roles--permissions)
16. [What Is Complete](#16-what-is-complete)
17. [What Is Remaining](#17-what-is-remaining)
18. [Demo Credentials](#18-demo-credentials)

---

## 1. Project Overview

AuraOS is a **multi-tenant Restaurant POS (Point of Sale) platform** built for production use.

**Core capabilities:**
- Staff take orders on phones/tablets (PWA — no app store needed)
- Customers order by scanning a QR code (no login needed)
- Kitchen sees orders in real-time on a display screen
- WhatsApp customers can order by sending a message
- Zomato orders flow in automatically via webhook
- Admin sees live revenue, top items, inventory alerts


---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 18 + TypeScript (strict) |
| Web framework | Express 4 |
| Database | PostgreSQL 15 |
| ORM | None — raw SQL with `pg` (parameterized queries) |
| Auth | JWT (access 15m + refresh 7d) + bcryptjs |
| Validation | Zod schemas on all inputs |
| Real-time | Socket.io 4 |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Notifications | react-hot-toast |
| Icons | @heroicons/react |
| PWA | vite-plugin-pwa + Workbox |
| HTTP client | Axios |

---

## 3. Project Structure

```
AuraOS/
├── src/                          ← Backend source
│   ├── app.ts                    ← Express app, middleware, route registration
│   ├── server.ts                 ← HTTP server + Socket.io init
│   ├── config/
│   │   ├── database.ts           ← PostgreSQL pool (max 20 connections)
│   │   └── payments.ts           ← Payment gateway config (Razorpay/Stripe/etc.)
│   ├── modules/                  ← Feature modules
│   │   ├── auth/                 ← Login, register, JWT
│   │   ├── restaurants/          ← Restaurant profile + settings
│   │   ├── tables/               ← Physical table management
│   │   ├── menu/                 ← Categories + items
│   │   ├── orders/               ← Order lifecycle + running tab
│   │   ├── payments/             ← Payment recording
│   │   ├── inventory/            ← Stock tracking
│   │   ├── reports/              ← Dashboard + analytics
│   │   ├── users/                ← Staff management
│   │   └── public/               ← Public endpoints (no auth) for QR ordering
│   ├── integrations/
│   │   ├── zomato/               ← Zomato webhook receiver
│   │   └── whatsapp/             ← WhatsApp order parser
│   └── shared/
│       ├── errors/               ← AppError, NotFoundError, etc.
│       ├── middleware/           ← authenticate, authorize, validateRequest
│       ├── socket/               ← EventBroadcaster (Socket.io)
│       └── utils/                ← successResponse, errorResponse
│
├── client/                       ← Staff Portal (React PWA)
│   ├── public/                   ← PWA icons, manifest
│   ├── src/
│   │   ├── pages/                ← All page components
│   │   ├── components/           ← Reusable UI components
│   │   ├── contexts/             ← AuthContext, SocketContext, AppStore
│   │   ├── lib/                  ← formatCurrency, formatDate, cn()
│   │   └── types/                ← TypeScript interfaces
│   └── vite.config.ts            ← PWA config, proxy, build settings
│
├── apps/                         ← Future standalone apps (see apps/README.md)
├── migrations/                   ← SQL migration files (run in order)
├── scripts/                      ← Utility scripts
├── .env                          ← Your secrets (not in git)
├── .env.example                  ← Template — copy to .env
└── docker-compose.yml            ← PostgreSQL via Docker
```


---

## 4. How to Run

### Prerequisites
- Node.js 18+
- PostgreSQL 15 (local or Docker)

### Step 1 — Clone and install

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd client && npm install
```

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Minimum required in `.env`:
```
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/auraos
JWT_SECRET=any_random_string_at_least_32_characters_long
NODE_ENV=development
```

### Step 3 — Start PostgreSQL

```bash
# Option A: Docker
docker-compose up -d

# Option B: Already running locally — just make sure DATABASE_URL is correct
```

### Step 4 — Run migrations

```bash
npm run migrate
```

This creates all tables and loads demo data (restaurant, 4 users, 5 tables, 8 menu items).

### Step 5 — Start servers

```bash
# Terminal 1 — Backend (port 3000)
npm run dev

# Terminal 2 — Frontend (port 3001)
cd client && npm run dev
```

### Step 6 — Open the app

| URL | What it is |
|-----|-----------|
| http://localhost:3001 | Staff Portal |
| http://localhost:3001/customer?slug=demo-kitchen | Customer QR ordering |
| http://localhost:3001/kitchen | Kitchen Display |
| http://localhost:3001/qr-settings | QR code generator (admin) |
| http://localhost:3000/api/v1/health | API health check |

### Step 7 — Install as PWA on phone (waiter app)

1. Find your PC's IP: run `ipconfig` → look for IPv4 address (e.g. 192.168.1.10)
2. On the waiter's phone (same WiFi): open `http://192.168.1.10:3001`
3. Chrome: tap ⋮ → "Add to Home Screen"
4. iOS Safari: tap Share → "Add to Home Screen"
5. App opens full-screen like a native app


---

## 5. Database Schema

11 tables across 6 migration files.

```
restaurants          ← Multi-tenant root. Every record belongs to a restaurant.
  id, name, slug, auto_approve_online_orders, delay_threshold_minutes, qr_mode

users                ← Staff accounts, scoped to a restaurant
  id, restaurant_id, email, password_hash, name, role, is_active

restaurant_tables    ← Physical tables in the restaurant
  id, restaurant_id, table_number, seats, is_active

menu_categories      ← Menu sections (Starters, Mains, Beverages)
  id, restaurant_id, name, description, display_order, is_active

menu_items           ← Individual dishes
  id, restaurant_id, category_id, name, description, price,
  prep_time_minutes, is_vegetarian, is_active, display_order

orders               ← Order records with state machine
  id, restaurant_id, table_id, order_number, order_type, order_source,
  status, total_amount, priority_score, special_instructions,
  created_by, created_at, updated_at, completed_at

order_items          ← Line items within an order
  id, order_id, restaurant_id, menu_item_id, quantity, unit_price,
  special_instructions, status (PENDING/PREPARING/DONE)

payments             ← Payment records linked to orders
  id, restaurant_id, order_id, amount, method, status, reference_number

inventory_items      ← Stock levels per menu item
  id, restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at

integration_logs     ← Audit trail for WhatsApp/Zomato/QR webhooks
  id, restaurant_id, source, status, payload, error_message, external_id, order_id

migrations_log       ← Tracks which migrations have run
```

**Enums:**
- `user_role`: ADMIN, WAITER, RECEPTION, KITCHEN
- `order_status`: CREATED, ACCEPTED, PREPARING, READY, COMPLETED, CANCELLED
- `order_type`: DINE_IN, PARCEL, ONLINE
- `order_source`: WAITER, RECEPTION, QR, WHATSAPP, ZOMATO
- `item_status`: PENDING, PREPARING, DONE
- `payment_method`: CASH, CARD, UPI, ONLINE
- `payment_status`: PENDING, PAID, REFUNDED
- `qr_mode`: restaurant, mall


---

## 6. All API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Public (no auth)
```
GET  /health                              ← Server health check
GET  /public/menu/:slug                   ← Full menu for QR ordering
GET  /public/tables/:slug                 ← Active tables for QR ordering
POST /public/order/:slug                  ← Place guest order (QR/kiosk)
```

### Auth
```
POST /auth/register                       ← Create account (WAITER role)
POST /auth/login                          ← Login → returns JWT token
POST /auth/refresh                        ← Refresh access token
GET  /auth/me                             ← Get current user profile
POST /auth/logout                         ← Logout (client clears token)
```

### Restaurants (admin)
```
GET    /restaurants/me                    ← Get restaurant profile
PUT    /restaurants/me                    ← Update name, settings, qr_mode
GET    /restaurants/me/stats              ← Today's orders, revenue, staff count
DELETE /restaurants/me                    ← Delete restaurant
GET    /restaurants/:slug                 ← Public lookup by slug
POST   /restaurants                       ← Create new restaurant (admin)
GET    /restaurants                       ← List all restaurants (admin)
```

### Tables
```
GET    /tables                            ← List all tables
GET    /tables/stats                      ← Table occupancy stats (admin)
GET    /tables/:id                        ← Get single table
POST   /tables                            ← Create table (admin)
PUT    /tables/:id                        ← Update table (admin)
PATCH  /tables/:id                        ← Update table (admin)
DELETE /tables/:id                        ← Delete table (admin)
```

### Menu
```
GET    /menus                             ← Full menu overview
GET    /menus/stats                       ← Menu stats (admin)
GET    /menus/categories                  ← List categories
GET    /menus/categories/:id              ← Get single category
POST   /menus/categories                  ← Create category (admin)
PUT    /menus/categories/:id              ← Update category (admin)
DELETE /menus/categories/:id              ← Delete category (admin)
GET    /menus/items                       ← List all items
GET    /menus/items/:id                   ← Get single item
POST   /menus/items                       ← Create item (admin)
PUT    /menus/items/:id                   ← Update item (admin)
DELETE /menus/items/:id                   ← Delete item (admin)
```

### Orders
```
POST   /orders                            ← Create order
GET    /orders                            ← List orders (with filters)
GET    /orders/stats                      ← Order stats (admin)
GET    /orders/active/by-table/:tableId   ← Find open order for a table
GET    /orders/:id                        ← Get order with items + table
PUT    /orders/:id                        ← Update status / notes
PATCH  /orders/:id                        ← Update status / notes
POST   /orders/:id/items                  ← Add items to existing order (running tab)
DELETE /orders/:id                        ← Delete order (admin)
```

### Payments
```
POST   /payments                          ← Record payment
GET    /payments                          ← List payments
GET    /payments/stats                    ← Payment stats (admin)
GET    /payments/:id                      ← Get single payment
PUT    /payments/:id                      ← Update payment
DELETE /payments/:id                      ← Delete payment (admin)
```

### Inventory
```
GET    /inventory                         ← List inventory (with item names)
GET    /inventory/stats                   ← Stock stats (admin)
GET    /inventory/:id                     ← Get single item
POST   /inventory                         ← Create inventory item (admin)
PUT    /inventory/:id                     ← Update stock (admin)
PATCH  /inventory/:id                     ← Update stock (admin)
DELETE /inventory/:id                     ← Delete (admin)
```

### Reports (admin only)
```
GET    /reports/dashboard                 ← Today's KPIs
GET    /reports/top-items                 ← Top selling items
GET    /reports/daily-revenue             ← Revenue by day (configurable range)
GET    /reports/inventory-alerts          ← Items at/below reorder level
```

### Users (admin only)
```
GET    /users                             ← List staff
GET    /users/:id                         ← Get user
POST   /users                             ← Create user
PUT    /users/:id                         ← Update user
PATCH  /users/:id                         ← Update user
PATCH  /users/:id/password                ← Reset password
DELETE /users/:id                         ← Delete user
```

### Integrations
```
POST   /integrations/zomato/webhook       ← Receive Zomato order
GET    /integrations/zomato/sync-status   ← Zomato sync stats
POST   /integrations/whatsapp/webhook     ← Receive WhatsApp message
GET    /integrations/whatsapp/webhook     ← Meta webhook verification
GET    /integrations/whatsapp/sync-status ← WhatsApp sync stats
```


---

## 7. Order Workflows

### Order State Machine
```
CREATED → ACCEPTED → PREPARING → READY → COMPLETED
                ↘         ↘         ↘        ↘
              CANCELLED  CANCELLED  CANCELLED  CANCELLED
```

Invalid transitions are rejected by the backend with a 400 error.

### Workflow 1 — Waiter takes order (staff app)
```
1. Waiter opens http://YOUR_IP:3001 on phone (PWA installed)
2. Goes to Orders → New Order
3. Selects table, order type (DINE_IN), source (WAITER)
4. Taps menu items to add to cart
5. Taps "Place Order"
   → POST /api/v1/orders
   → Backend creates order (status: CREATED)
   → Socket.io broadcasts ORDER_CREATED to restaurant room
   → Kitchen Display updates instantly
6. Kitchen accepts → ACCEPTED → PREPARING → READY
7. Waiter sees READY status → serves food
8. Waiter taps "Pay" → records payment
9. Order marked COMPLETED
```

### Workflow 2 — Customer scans QR (restaurant mode)
```
1. Customer scans QR code on table
   → Opens http://YOUR_IP:3001/customer?slug=demo-kitchen
2. Selects table number (T1, T2, etc.)
3. Browses menu, adds items to cart
4. Taps "Place Order"
   → POST /api/v1/public/order/demo-kitchen
   → Backend creates order (source: QR)
   → Socket.io broadcasts ORDER_CREATED ← (this was missing, now fixed)
   → Kitchen Display updates instantly
5. Kitchen prepares → marks READY
6. Staff collects payment at counter
```

### Workflow 3 — Customer scans QR (mall/food court mode)
```
1. Customer scans QR code at counter
2. Enters name + phone number
3. Selects payment method (UPI / Card / Online / Pay at Counter)
4. Browses menu, adds items
5. Taps "Place Order · ₹XXX"
   → POST /api/v1/public/order/demo-kitchen
   → If payment ≠ CASH: creates pending payment record
   → Socket.io broadcasts ORDER_CREATED
   → Kitchen Display updates instantly
6. Customer gets confirmation screen with order number
7. Staff calls order number when ready
```

### Workflow 4 — Running Tab (add items to existing order)
```
1. Customer already has an open order (e.g. ORD-001)
2. Waiter opens New Order, selects same table
   → Frontend calls GET /orders/active/by-table/:tableId
   → Finds existing open order
   → Shows banner: "Table T3 has open order ORD-001 — Add to it?"
3. Waiter adds new items, taps "Add to ORD-001"
   → POST /orders/ORD-001/items
   → Backend merges items (same dish + same note = quantity increment)
   → Recalculates total in DB transaction
   → Socket.io broadcasts ORDER_UPDATED
4. Kitchen sees updated order with new items
```

### Workflow 5 — WhatsApp order
```
1. Customer sends WhatsApp message to restaurant number:
   "2 Biryani and 1 Mango Lassi"
2. Meta sends webhook to POST /integrations/whatsapp/webhook
3. Backend parses message (fuzzy matching against menu):
   - "biryani" → matches "Biryani" (exact)
   - "mango lassi" → matches "Mango Lassi" (exact)
4. Creates order (source: WHATSAPP)
5. Socket.io broadcasts ORDER_CREATED → KDS updates
6. Replies to customer:
   "✅ Order Confirmed! Order #WA-xxx
    • 2x Biryani — ₹560
    • 1x Mango Lassi — ₹60
    Total: ₹620
    Estimated time: 20–30 mins"
```

### Workflow 6 — Zomato order
```
1. Customer orders on Zomato app
2. Zomato sends webhook to POST /integrations/zomato/webhook
   (with header X-Restaurant-ID: your-restaurant-uuid)
3. Backend checks for duplicate (by Zomato order_id)
4. Creates order (source: ZOMATO, type: ONLINE)
5. Logs to integration_logs
6. Socket.io broadcasts ORDER_CREATED → KDS updates
7. Staff sees order in Orders page and Kitchen Display
```


---

## 8. Real-time Events (Socket.io)

### How it works
- Backend: `src/server.ts` creates Socket.io server on port 3000
- Every authenticated user auto-joins room `restaurant:{restaurantId}`
- All events are scoped to that room — no cross-restaurant leakage
- Frontend: `SocketContext.tsx` connects on login, disconnects on logout

### Authentication
Socket.io connections require a valid JWT token:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
})
```

### Events broadcast by the backend

| Event | Triggered when | Payload |
|-------|---------------|---------|
| `ORDER_CREATED` | New order placed (any source) | `{ order_id, restaurant_id, status, total_amount, table_id }` |
| `ORDER_UPDATED` | Status changed, items added | same |
| `ORDER_COMPLETED` | Order marked COMPLETED | same |
| `ORDER_CANCELLED` | Order cancelled | same |
| `ORDER_DELETED` | Order deleted | same |
| `PAYMENT_CREATED` | Payment recorded | `{ payment_id, order_id, amount, status }` |
| `INVENTORY_UPDATED` | Stock level changed | `{ inventory_item_id, current_stock, reorder_level }` |
| `INVENTORY_LOW_STOCK` | Stock at/below reorder level | same |

### Pages that listen to events

| Page | Events listened |
|------|----------------|
| Dashboard | ORDER_CREATED, ORDER_UPDATED, ORDER_COMPLETED, PAYMENT_COMPLETED |
| Orders | ORDER_CREATED, ORDER_UPDATED, ORDER_DELETED |
| Kitchen Display | ORDER_CREATED, ORDER_UPDATED |
| Tables | TABLE_OCCUPIED, TABLE_FREED (not yet broadcast — see remaining work) |

---

## 9. QR Ordering System

### Admin setup
1. Login as ADMIN → go to **QR Settings** (sidebar)
2. Choose mode:
   - **Restaurant mode** — customer picks table, pays at counter
   - **Mall mode** — customer enters name + phone, picks payment method
3. Click **Save Mode**
4. **Download** or **Print** the QR code
5. Place the printed QR on tables / counter

### One QR for everything
The QR URL is: `http://YOUR_DOMAIN/customer?slug=demo-kitchen`

The same URL works for both modes. Changing the mode in admin settings changes the customer experience without reprinting the QR.

### Restaurant mode flow
- Customer scans → selects table from grid → browses menu → orders
- Payment: at counter only

### Mall mode flow
- Customer scans → enters name + phone → picks payment (UPI/Card/Online/Pay at Counter)
- Payment: online payment intent recorded, gateway integration pending

### Public API (no auth required)
```
GET  /api/v1/public/menu/:slug    ← Returns restaurant info + categories + items
GET  /api/v1/public/tables/:slug  ← Returns active tables
POST /api/v1/public/order/:slug   ← Creates order, broadcasts to KDS
```

---

## 10. WhatsApp Integration

### Setup (Meta Business API)
1. Create a Meta Developer account: https://developers.facebook.com
2. Create a WhatsApp Business app
3. Get your credentials and add to `.env`:
   ```
   WHATSAPP_VERIFY_TOKEN=your_verify_token
   WHATSAPP_ACCESS_TOKEN=your_access_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   ```
4. Set webhook URL in Meta dashboard:
   `https://YOUR_DOMAIN/api/v1/integrations/whatsapp/webhook`
5. Set `X-Restaurant-ID` header to your restaurant UUID

### Message formats supported
```
2x Biryani, 1x Naan          ← structured
2 biryani and 1 naan          ← natural language
biryani x2, naan              ← reverse format
I want 2 biryanis and a lassi ← conversational
Biryani - 2, Butter Chicken   ← dash-separated
menu                          ← shows full menu list
```

### Matching logic
1. Exact match (case-insensitive)
2. Menu item name starts with search text
3. Menu item name contains search text
4. Search text contains menu item name (handles plurals like "biryanis")
5. Word overlap score (picks highest)

### Testing locally
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/integrations/whatsapp/webhook" `
  -Method POST `
  -Headers @{
    "Content-Type"="application/json"
    "X-Restaurant-ID"="11111111-1111-1111-1111-111111111111"
  } `
  -Body '{
    "messaging_product":"whatsapp",
    "metadata":{"display_phone_number":"1234567890","phone_number_id":"123"},
    "contacts":[{"profile":{"name":"John"},"wa_id":"919876543210"}],
    "messages":[{
      "from":"919876543210","id":"wamid.1","timestamp":"1234567890",
      "text":{"body":"2x Biryani, 1x Mango Lassi"},"type":"text"
    }]
  }'
```


---

## 11. Zomato Integration

### Setup
1. Get your restaurant UUID from the database or `/api/v1/restaurants/me`
2. In Zomato Partner Dashboard, set webhook URL:
   `https://YOUR_DOMAIN/api/v1/integrations/zomato/webhook`
3. Add header: `X-Restaurant-ID: your-restaurant-uuid`

### Known limitation
Zomato sends its own item IDs. The current code assumes Zomato item IDs match your internal menu item UUIDs — this will fail in production. You need to create a mapping table:
```sql
CREATE TABLE zomato_item_mapping (
  zomato_item_id VARCHAR(100),
  menu_item_id UUID REFERENCES menu_items(id),
  restaurant_id UUID REFERENCES restaurants(id)
);
```
Then update `zomato.service.ts` to look up the mapping before creating order items.

### Testing locally
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/integrations/zomato/webhook" `
  -Method POST `
  -Headers @{
    "Content-Type"="application/json"
    "X-Restaurant-ID"="11111111-1111-1111-1111-111111111111"
  } `
  -Body '{
    "order_id":"ZOMATO-TEST-001",
    "restaurant_id":"11111111-1111-1111-1111-111111111111",
    "customer_name":"Test Customer",
    "customer_phone":"+91 9876543210",
    "items":[{"item_id":"ITEM1","item_name":"Biryani","quantity":2,"price":300}],
    "total_amount":600,
    "status":"RECEIVED",
    "timestamp":"2026-05-30T10:00:00Z"
  }'
```

---

## 12. Payment Gateways

### Current state
The system records **payment intent** (which method the customer chose) but does **not process real payments**. Cash payments work end-to-end. Online payments (UPI/Card/Online) create a `PENDING` payment record but no actual charge happens.

### Config file
All gateway setup instructions are in `src/config/payments.ts` with step-by-step comments.

### To add Razorpay (recommended for India)
1. Create account: https://dashboard.razorpay.com
2. Get API keys from Settings → API Keys
3. Add to `.env`:
   ```
   PAYMENT_GATEWAY=razorpay
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```
4. `npm install razorpay`
5. Create `src/modules/payments/gateways/razorpay.gateway.ts`
6. Create `src/modules/payments/payments.webhook.ts`
7. Register webhook route in `src/app.ts`

### Payment flow (once gateway is implemented)
```
Customer places QR order
  → Backend creates order + pending payment
  → Returns { order_number, payment_url }
  → Customer redirected to payment_url (Razorpay checkout)
  → Customer pays
  → Razorpay sends webhook to /api/v1/webhooks/payments
  → Backend verifies signature
  → Updates payment status → PAID
  → Updates order status → ACCEPTED
  → Socket.io broadcasts PAYMENT_COMPLETED
  → Kitchen Display shows order
```

### Supported methods (UI already built)
| Method | Gateway needed |
|--------|---------------|
| CASH | None — works now |
| UPI | Razorpay / Cashfree / PayU |
| CARD | Razorpay / Stripe |
| ONLINE | Razorpay / Cashfree |


---

## 13. PWA — Waiter App

The staff portal is a **Progressive Web App**. Waiters install it on their phones like a native app — no App Store, no Play Store.

### What PWA gives you
- Full-screen (no browser chrome)
- Works offline (cached UI loads without internet)
- App icon on home screen
- Long-press shortcuts: New Order, Kitchen, Tables
- Fast load (pre-cached assets)

### Install on Android (Chrome)
1. Open `http://YOUR_PC_IP:3001` in Chrome
2. Tap ⋮ menu → "Add to Home Screen" or "Install App"
3. Tap "Install"
4. App appears on home screen

### Install on iPhone (Safari)
1. Open `http://YOUR_PC_IP:3001` in Safari
2. Tap Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

### For production
- Serve over **HTTPS** (required for PWA install prompts)
- Replace SVG icons in `client/public/` with proper PNG icons
- Use https://realfavicongenerator.net to generate all icon sizes

### PWA config location
`client/vite.config.ts` — fully commented, explains every setting.

### App shortcuts (long-press icon on Android)
- **New Order** → `/orders`
- **Kitchen Display** → `/kitchen`
- **Tables** → `/tables`

---

## 14. Frontend Pages

| Page | URL | Role | Description |
|------|-----|------|-------------|
| Login | `/login` | All | Split-panel login with demo credentials |
| Register | `/register` | All | Creates WAITER account |
| Dashboard | `/` | All | Live KPIs, revenue chart, top items |
| Orders | `/orders` | All | Tabbed view (Active/Ready/Completed), card grid, workflow buttons |
| Order Details | `/orders/:id` | All | Full order with items, prices, add items, pay |
| Kitchen Display | `/kitchen` | All | Full-screen dark KDS, live timers, color-coded cards |
| Tables | `/tables` | All | Card grid, stats, create/edit/delete |
| Menu | `/menu` | All | Category management, item grid, availability toggle |
| Payments | `/payments` | All | Transaction list, stats, record payment |
| Inventory | `/inventory` | Admin | Stock levels, adjust modal, low-stock alerts |
| Users | `/users` | Admin | Staff management, role badges, password reset |
| Reports | `/reports` | Admin | Charts (area, bar, pie), revenue trends, alerts |
| QR Settings | `/qr-settings` | Admin | Generate QR, choose mode, download/print |
| Customer App | `/customer` | Public | QR ordering (no login) |
| Password Reset | `/password-reset` | All | UI exists, backend not implemented |

### Key components
| Component | Purpose |
|-----------|---------|
| `Layout.tsx` | Responsive sidebar (desktop fixed, mobile drawer) |
| `OrderForm.tsx` | POS-style order creation with menu grid + cart |
| `AddItemsModal.tsx` | Add items to existing order (running tab) |
| `PaymentForm.tsx` | Record payment with method selection |
| `TableForm.tsx` | Create/edit table with quick-pick chips |
| `MenuForm.tsx` | Create/edit menu item |

---

## 15. User Roles & Permissions

| Feature | ADMIN | WAITER | KITCHEN | RECEPTION |
|---------|-------|--------|---------|-----------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Create orders | ✅ | ✅ | ❌ | ✅ |
| View orders | ✅ | ✅ | ✅ | ✅ |
| Update order status | ✅ | ✅ | ✅ | ✅ |
| Delete orders | ✅ | ❌ | ❌ | ❌ |
| Kitchen Display | ✅ | ✅ | ✅ | ✅ |
| Tables | ✅ | ✅ | ❌ | ✅ |
| Create/edit tables | ✅ | ❌ | ❌ | ❌ |
| Menu (view) | ✅ | ✅ | ✅ | ✅ |
| Menu (edit) | ✅ | ❌ | ❌ | ❌ |
| Payments | ✅ | ✅ | ❌ | ✅ |
| Inventory | ✅ | ❌ | ❌ | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ❌ | ❌ | ❌ |
| QR Settings | ✅ | ❌ | ❌ | ❌ |


---

## 16. What Is Complete

### Backend ✅
- [x] Multi-tenant architecture (all data scoped by restaurant_id)
- [x] JWT authentication (access + refresh tokens)
- [x] Role-based access control (ADMIN/WAITER/KITCHEN/RECEPTION)
- [x] All 8 core modules (auth, restaurants, tables, menu, orders, payments, inventory, reports)
- [x] Users module (admin CRUD + password reset)
- [x] Order state machine with transition validation
- [x] Running tab — add items to existing open order
- [x] Active order lookup by table (prevents duplicate orders)
- [x] Item merging (same dish + same note = quantity increment)
- [x] Priority scoring (DINE_IN + WAITER = highest priority)
- [x] Socket.io real-time events (all order/payment/inventory events)
- [x] Socket.io JWT authentication
- [x] Auto room join on connect
- [x] Public endpoints for QR ordering (no auth)
- [x] QR mode setting (restaurant vs mall)
- [x] WhatsApp webhook receiver + smart fuzzy parser
- [x] Zomato webhook receiver + deduplication
- [x] Inventory with item names joined (not raw UUIDs)
- [x] Dashboard stats scoped to today
- [x] Occupied tables count in dashboard
- [x] Payment gateway config stub (Razorpay/Stripe/Cashfree/PayU)
- [x] Clean project structure (81 stale files deleted)

### Frontend ✅
- [x] Production design system (Tailwind + component library)
- [x] Responsive layout (desktop sidebar + mobile drawer)
- [x] PWA — installable on phones as native app
- [x] App shortcuts (long-press icon)
- [x] Login page (split-panel design)
- [x] Dashboard with live charts (Recharts)
- [x] Orders page — tabbed, card grid, one-tap workflow
- [x] Order Details — items with names + prices, add items, pay
- [x] Kitchen Display — dark mode, live timers, color-coded
- [x] Tables — card grid, stats, production form with quick-picks
- [x] Menu — category management, grid, availability toggle
- [x] Payments — stats, table, filters
- [x] Inventory — item names, stock adjust, alerts
- [x] Reports — area + bar + pie charts, 7/14/30d toggle
- [x] Users — full CRUD, role badges, password reset
- [x] QR Settings — mode selector, QR display, download, print
- [x] Customer App — restaurant + mall modes, cart, confirmation
- [x] react-hot-toast notifications throughout
- [x] Socket.io live updates on all pages
- [x] React Router future flags (no console warnings)

---

## 17. What Is Remaining

### High priority
| Item | Effort | Notes |
|------|--------|-------|
| Password reset backend | Medium | Need email service (Nodemailer/SendGrid) + `password_reset_tokens` table |
| Online payment gateway | Medium | Config ready in `src/config/payments.ts` — just implement one gateway |
| Zomato item ID mapping | Medium | Need `zomato_item_mapping` table + lookup in `zomato.service.ts` |
| Role-based URL guards | Small | Nav hides pages but direct URL access not blocked for non-admins |

### Medium priority
| Item | Effort | Notes |
|------|--------|-------|
| Zomato manual/auto approval | Medium | `auto_approve_online_orders` column exists but never checked |
| Table real-time events | Small | `TABLE_OCCUPIED`/`TABLE_FREED` events exist but never broadcast |
| WhatsApp webhook signature verification | Small | Currently accepts any POST — add Meta signature check |
| Individual order item status | Medium | `order_items.status` (PENDING/PREPARING/DONE) exists but never updated |
| Stock change history | Medium | Inventory only stores current level, no log of changes |

### Low priority / Future
| Item | Notes |
|------|-------|
| Native mobile app | `apps/` folder ready — build React Native app using `/api/v1/public/*` |
| Kiosk app | Electron or full-screen browser app for self-service counter |
| Multi-restaurant onboarding | No UI to create new restaurants — admin API exists |
| Dark mode | Kitchen is dark, rest of app is light-only |
| Export reports | No CSV/PDF export |
| Tax configuration | CustomerApp hardcodes 18% GST |
| Error boundaries | No React error boundary — JS error crashes whole app |
| Rate limiting | Login endpoint is brute-forceable |

---

## 18. Demo Credentials

```
Restaurant: Demo Kitchen (slug: demo-kitchen)
Restaurant ID: 11111111-1111-1111-1111-111111111111

Admin:
  Email:    admin@demo-kitchen.local
  Password: demo1234
  Access:   Everything

Waiter:
  Email:    waiter@demo-kitchen.local
  Password: demo123
  Access:   Orders, Tables, Menu, Payments, Kitchen

Kitchen:
  Email:    kitchen@demo-kitchen.local
  Password: demo123
  Access:   Orders (view + status), Kitchen Display

Reception:
  Email:    reception@demo-kitchen.local
  Password: demo123
  Access:   Orders, Tables
```

---

## Quick Reference

### Common commands
```bash
npm run dev          # Start backend (port 3000)
npm run build        # Compile TypeScript
npm run migrate      # Run all DB migrations
npm test             # Run Jest tests

cd client
npm run dev          # Start frontend (port 3001)
npm run build        # Build for production
```

### Find your PC's IP (for phone testing)
```bash
# Windows
ipconfig
# Look for: IPv4 Address . . . . . . . . . . : 192.168.x.x

# Then open on phone: http://192.168.x.x:3001
```

### Test API health
```bash
curl http://localhost:3000/api/v1/health
# Expected: {"success":true,"data":{"status":"ok"}}
```

### Get a JWT token for API testing
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@demo-kitchen.local","password":"demo123"}'
$token = $response.data.token
# Use: -Headers @{"Authorization"="Bearer $token"}
```

---

*This document covers everything built in AuraOS as of May 2026.*
*For payment gateway implementation, see `src/config/payments.ts`.*
*For future app development, see `apps/README.md`.*
