# AuraOS Waiter App Architecture

## Overview

The AuraOS Waiter App is a React Native + Expo + TypeScript mobile application that connects waiters to the central AuraOS backend. It enables waiters to manage tables, create orders, update order status, process payments, and receive real-time kitchen updates.

---

## System Architecture

### High-Level System Design

```mermaid
graph TB
    subgraph "Client Layer"
        WaiterApp["Waiter App<br/>(React Native + Expo)"]
    end
    
    subgraph "API Gateway"
        REST["REST API<br/>(Express.js)"]
        SocketIO["Socket.IO<br/>(Real-time)"]
    end
    
    subgraph "Backend Services"
        Auth["Authentication<br/>(JWT)"]
        Orders["Orders Service"]
        Tables["Tables Service"]
        Menu["Menu Service"]
        Payments["Payments Service"]
        Users["Users Service"]
    end
    
    subgraph "Data Layer"
        DB["PostgreSQL<br/>(Multi-tenant)"]
        Cache["Redis Cache<br/>(Sessions, Menus)"]
    end
    
    WaiterApp -->|HTTP REST| REST
    WaiterApp -->|WebSocket| SocketIO
    REST --> Auth
    REST --> Orders
    REST --> Tables
    REST --> Menu
    REST --> Payments
    REST --> Users
    Auth --> DB
    Orders --> DB
    Tables --> DB
    Menu --> DB
    Payments --> DB
    Users --> DB
    Auth --> Cache
    Menu --> Cache
```

---

## Multi-Tenancy Architecture

AuraOS uses **restaurant-scoped multi-tenancy**:

- Each restaurant is a separate tenant
- Users belong to exactly one restaurant
- All API responses are automatically filtered to the user's restaurant
- JWT token contains `restaurantId` for tenant isolation

```mermaid
graph TD
    User["User (e.g., John, WAITER)"]
    Restaurant["Restaurant<br/>(e.g., Demo Kitchen)"]
    Tables["Tables for this restaurant"]
    Orders["Orders for this restaurant"]
    Menu["Menu for this restaurant"]
    
    User -->|Belongs to| Restaurant
    Restaurant -->|Contains| Tables
    Restaurant -->|Contains| Orders
    Restaurant -->|Contains| Menu
```

### Tenant Isolation Strategy

- **Row-Level Security (RLS)**: PostgreSQL RLS policies ensure users only see their restaurant's data
- **JWT Payload**: `restaurantId` extracted from token and used in all queries
- **API Filtering**: Every service checks `restaurantId` before returning data
- **WebSocket Rooms**: Real-time broadcasts sent to restaurant-specific rooms only

---

## Authentication Flow

### Login and Token Generation

```mermaid
sequenceDiagram
    participant Client as Waiter App
    participant API as REST API
    participant Auth as Auth Service
    participant DB as PostgreSQL
    participant JWT as JWT Generator
    
    Client->>API: POST /auth/login<br/>(email, password)
    API->>Auth: Validate credentials
    Auth->>DB: Find user by email
    DB-->>Auth: User record
    Auth->>Auth: Compare password hash
    Auth->>JWT: Generate tokens
    JWT-->>Auth: access_token (15m)<br/>refresh_token (7d)
    Auth-->>API: TokenPair
    API-->>Client: {<br/>  token: "eyJ...",<br/>  refreshToken: "eyJ...",<br/>  user: {...}<br/>}
```

### Token Usage in Requests

Every authenticated request includes the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**JWT Payload Structure:**
```json
{
  "id": "user-uuid",
  "email": "john@restaurant.local",
  "role": "WAITER",
  "restaurantId": "restaurant-uuid",
  "iat": 1718700000,
  "exp": 1718700900
}
```

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant Client as Waiter App
    participant API as REST API
    participant JWT as JWT Verifier
    
    Client->>Client: Check token expiry
    alt Token Expired
        Client->>API: POST /auth/refresh<br/>(refreshToken)
        API->>JWT: Verify refresh token
        JWT-->>API: Valid
        API->>API: Issue new access_token
        API-->>Client: {token: "new_eyJ..."}
        Client->>Client: Update stored token
    else Token Valid
        Client->>API: Use existing token
    end
```

### User Roles

| Role | Description | Permissions |
|------|-------------|------------|
| **ADMIN** | Restaurant owner/manager | All operations |
| **WAITER** | Table server | Create orders, update orders, view menu, manage payments |
| **RECEPTION** | Front desk staff | Manage reservations, view tables |
| **KITCHEN** | Kitchen staff | Update order item status, view orders |

---

## Restaurant Tenancy

### Tenant Context

Every request carries the tenant (restaurant) context through the JWT token:

```mermaid
graph LR
    subgraph "Request Context"
        Token["JWT Token<br/>{restaurantId}"]
    end
    
    subgraph "Middleware Processing"
        Auth["Extract restaurantId<br/>from token"]
        Attach["Attach to request<br/>req.user.restaurantId"]
    end
    
    subgraph "Service Layer"
        Service["Service uses restaurantId<br/>for all queries"]
    end
    
    Token --> Auth
    Auth --> Attach
    Attach --> Service
```

### Data Isolation

- **Database Level**: PostgreSQL RLS policies
- **API Level**: Every query filters by `restaurant_id = req.user.restaurantId`
- **WebSocket Level**: Socket.IO rooms named `restaurant:{restaurantId}`

---

## Socket.IO Real-Time Flow

### Connection Sequence

```mermaid
sequenceDiagram
    participant WaiterApp as Waiter App
    participant SocketServer as Socket.IO Server
    participant Auth as JWT Verifier
    participant Broadcaster as Event Broadcaster
    
    WaiterApp->>SocketServer: Connect<br/>(auth: {token})
    SocketServer->>Auth: Verify JWT
    Auth-->>SocketServer: Valid
    SocketServer->>SocketServer: Extract restaurantId
    WaiterApp->>SocketServer: emit join_restaurant<br/>({restaurantId})
    SocketServer->>SocketServer: socket.join("restaurant:xyz")
    Note over SocketServer: Socket now in<br/>restaurant room
    
    Note over Broadcaster: Order created in backend
    Broadcaster->>SocketServer: broadcastOrderCreated<br/>({restaurantId})
    SocketServer->>WaiterApp: emit ORDER_CREATED<br/>({order data})
```

### WebSocket Rooms

| Room | Purpose | Members |
|------|---------|---------|
| `restaurant:{restaurantId}` | All staff events | Authenticated users in restaurant |
| `order:{orderNumber}` | Public order tracking | Customers, waiters |

### Event Categories

1. **Order Events**: ORDER_CREATED, ORDER_UPDATED, ORDER_READY, ORDER_COMPLETED, ORDER_CANCELLED
2. **Payment Events**: PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_COMPLETED
3. **Table Events**: TABLE_OCCUPIED, TABLE_FREED
4. **Inventory Events**: INVENTORY_LOW_STOCK, INVENTORY_UPDATED

---

## Waiter User Permissions

### What Waiters CAN Do

```mermaid
graph TB
    Waiter["WAITER User"]
    
    ViewTables["View Tables<br/>(GET /tables)"]
    TableStatus["See table status<br/>(occupied/available)"]
    CreateOrder["Create Orders<br/>(POST /orders)"]
    AddItems["Add items to order<br/>(POST /orders/:id/items)"]
    UpdateStatus["Update order status<br/>(PATCH /orders/:id)"]
    ViewMenu["View menu<br/>(GET /menus)"]
    CreatePayment["Create Payment<br/>(POST /payments)"]
    GetNotifications["Receive notifications<br/>(WebSocket)"]
    Profile["View own profile<br/>(GET /auth/me)"]
    
    Waiter --> ViewTables
    Waiter --> TableStatus
    Waiter --> CreateOrder
    Waiter --> AddItems
    Waiter --> UpdateStatus
    Waiter --> ViewMenu
    Waiter --> CreatePayment
    Waiter --> GetNotifications
    Waiter --> Profile
```

### What Waiters CANNOT Do

- ❌ Manage restaurant settings
- ❌ Delete users
- ❌ Manage inventory
- ❌ View analytics/reports
- ❌ Update menu items (ADMIN only)
- ❌ Modify tables (ADMIN only)
- ❌ Access payment settings (ADMIN only)

---

## Order State Machine

### Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CREATED: Order placed by waiter
    CREATED --> ACCEPTED: Kitchen accepts
    ACCEPTED --> PREPARING: Kitchen starts prep
    PREPARING --> READY: Dish is ready
    READY --> COMPLETED: Customer served
    READY --> SERVED: Served to customer
    SERVED --> COMPLETED: Bill paid
    
    CREATED --> CANCELLED: Cancelled anytime
    ACCEPTED --> CANCELLED: Cancelled anytime
    PREPARING --> CANCELLED: Cancelled anytime
    READY --> CANCELLED: Cancelled anytime
    SERVED --> CANCELLED: Cancelled anytime
    
    COMPLETED --> [*]
    CANCELLED --> [*]
    
    note right of CREATED
        Initial state when
        waiter creates order
    end note
    
    note right of ACCEPTED
        Kitchen acknowledged
        order
    end note
    
    note right of READY
        All items prepared
        and ready for service
    end note
    
    note right of COMPLETED
        Order fulfilled,
        payment collected
    end note
```

### Item Status Within Order

Each order item progresses independently:

```mermaid
stateDiagram-v2
    [*] --> PENDING: Item added to order
    PENDING --> PREPARING: Kitchen starts prep
    PREPARING --> DONE: Item is ready
    DONE --> [*]
```

---

## API Request/Response Pattern

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "order_number": "ORD-001",
    "status": "CREATED",
    "total_amount": 450.00
  },
  "message": "Order created successfully",
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Unauthorized access",
    "code": "UNAUTHORIZED"
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

---

## HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | GET, PATCH, PUT operations succeed |
| 201 | Created | POST operations succeed |
| 400 | Bad Request | Invalid JSON or validation error |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User doesn't have required role |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (unique constraint) |
| 500 | Server Error | Backend error |

---

## Data Consistency & Transactions

### Order Creation is Atomic

When a waiter creates an order:
1. Order record inserted
2. Order items inserted
3. Event broadcasted to kitchen
4. Total amount calculated
5. All within single database transaction

If any step fails, entire operation rolls back.

### Order Item Modifiers

When an item has modifiers:
- Modifier group ID and option stored with order item
- Price adjustment applied to final order amount
- Kitchen display shows full item name with modifiers

---

## Rate Limiting

- Global limit: 300 requests per minute per IP
- Auth endpoints: 10 attempts per minute (brute-force protection)
- Order creation: 60 orders per minute per user

---

## Error Handling Strategy

### Common Error Scenarios

| Scenario | Status | Response |
|----------|--------|----------|
| Invalid token | 401 | `{ error: { message: "Invalid token", code: "INVALID_TOKEN" } }` |
| Restaurant mismatch | 403 | `{ error: { message: "Forbidden", code: "FORBIDDEN" } }` |
| Table not found | 404 | `{ error: { message: "Table not found", code: "NOT_FOUND" } }` |
| Duplicate email | 409 | `{ error: { message: "User already exists", code: "CONFLICT" } }` |
| Missing required field | 400 | `{ error: { message: "Field 'email' is required", code: "VALIDATION_ERROR" } }` |

---

## Security Measures

1. **HTTPS**: All communication encrypted in transit
2. **CORS**: Restricted to authorized origins
3. **JWT**: Signed tokens with expiry
4. **Rate Limiting**: Prevent brute-force attacks
5. **Input Validation**: Zod schemas validate all inputs
6. **RLS**: PostgreSQL row-level security
7. **Password Hashing**: bcrypt with salt
8. **Token Refresh**: Short-lived access tokens, long-lived refresh tokens

---

## Performance Considerations

### Caching Strategy

- Menu items cached in Redis (TTL: 1 hour)
- User profiles cached (TTL: 30 minutes)
- Session tokens cached (TTL: match JWT expiry)

### Pagination

All list endpoints support pagination:
- `?limit=50` (default: 50, max: 100)
- `?offset=0` (default: 0)

### Database Indexes

Key indexes for performance:
- `idx_restaurants_slug`
- `idx_users_restaurant_id`
- `idx_orders_restaurant_id, status`
- `idx_tables_restaurant_id`
- `idx_menu_items_restaurant_id, is_active`

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client"
        WaiterApp["Waiter App<br/>(Expo Go / Build)"]
    end
    
    subgraph "CDN"
        CDN["Static Assets<br/>(Menu images, etc.)"]
    end
    
    subgraph "Infrastructure"
        LB["Load Balancer"]
        Server["AuraOS Server<br/>(Node.js)"]
        DB["PostgreSQL"]
        Redis["Redis"]
    end
    
    WaiterApp -->|HTTPS| LB
    LB --> Server
    Server --> DB
    Server --> Redis
    WaiterApp -->|Images| CDN
```

---

## Key Endpoints Used by Waiter

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get profile
- `POST /api/v1/auth/logout` - Logout

### Tables
- `GET /api/v1/tables` - List tables
- `GET /api/v1/tables/with-status` - Tables with occupancy
- `GET /api/v1/tables/:id` - Get specific table

### Menu
- `GET /api/v1/menus` - Get full menu
- `GET /api/v1/menus/categories` - Get categories
- `GET /api/v1/menus/items` - Get menu items

### Orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List orders
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders/:id/items` - Add items to order
- `PATCH /api/v1/orders/:id` - Update order status
- `GET /api/v1/orders/active/by-table/:tableId` - Get active order for table

### Payments
- `POST /api/v1/payments` - Create payment
- `GET /api/v1/payments` - List payments
- `GET /api/v1/payments/:id` - Get payment

---

## Development Workflow

### Environment Configuration

**Required environment variables for backend:**
```
API_BASE_URL=http://localhost:3000/api/v1
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost/auraos
REDIS_URL=redis://localhost:6379
PORT=3000
```

**Required in Waiter App:**
```
EXPO_PUBLIC_API_BASE_URL=http://your-backend-url/api/v1
EXPO_PUBLIC_RESTAURANT_ID=restaurant-uuid
```

### Local Development

1. Start AuraOS backend: `npm run dev` (port 3000)
2. Start Waiter App: `npx expo start` (port 8081)
3. Use Expo Go app on device to connect
4. WebSocket connects to same `API_BASE_URL` with Socket.IO upgrade

---

## Summary

- **Multi-tenant**: Isolated by `restaurantId` at DB, API, and WebSocket levels
- **Real-time**: Socket.IO for live order updates
- **Stateful**: Orders progress through defined state machine
- **Scalable**: Pagination, caching, connection pooling
- **Secure**: JWT, HTTPS, RLS, rate limiting
- **Mobile-first**: React Native + Expo for iOS/Android
