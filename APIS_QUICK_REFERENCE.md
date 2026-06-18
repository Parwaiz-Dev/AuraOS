# All Available APIs - Quick Reference

**Base URL**: `http://localhost:3000/api/v1`

**Authentication**: All requests require JWT token in header:
```
Authorization: Bearer {accessToken}
```

---

## 1. AUTHENTICATION APIs (3 endpoints)

### 1.1 Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@restaurant.com",
  "password": "password123"
}

Response (200):
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "john@restaurant.com",
      "name": "John Waiter",
      "role": "WAITER",
      "restaurant_id": "uuid",
      "is_active": true
    }
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 1.2 Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200):
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "timestamp": "2026-06-18T10:35:00Z"
}
```

### 1.3 Get Current User Profile
```http
GET /auth/me
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john@restaurant.com",
    "name": "John Waiter",
    "role": "WAITER",
    "restaurant_id": "uuid",
    "is_active": true,
    "created_at": "2026-05-01T08:00:00Z"
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

---

## 2. TABLE MANAGEMENT APIs (3 endpoints)

### 2.1 List All Tables
```http
GET /tables
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "tables": [
      {
        "id": "tbl-001",
        "restaurant_id": "rest-001",
        "table_number": 1,
        "capacity": 4,
        "location": "Main Hall - Window",
        "is_active": true,
        "created_at": "2026-01-01T08:00:00Z"
      },
      ...
    ],
    "total": 10
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 2.2 Get Tables with Real-Time Status
```http
GET /tables/with-status
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "tables": [
      {
        "id": "tbl-001",
        "table_number": 1,
        "capacity": 4,
        "status": "OCCUPIED",
        "current_order_id": "ord-uuid",
        "current_order_number": "ORD-001",
        "customer_count": 4,
        "seated_at": "2026-06-18T10:00:00Z"
      },
      {
        "id": "tbl-002",
        "table_number": 2,
        "capacity": 2,
        "status": "VACANT",
        "customer_count": 0
      }
    ],
    "summary": {
      "total_tables": 10,
      "occupied": 5,
      "vacant": 4,
      "reserved": 1,
      "total_capacity": 40,
      "current_guests": 18
    }
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 2.3 Get Single Table Details
```http
GET /tables/{tableId}
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "id": "tbl-001",
    "table_number": 1,
    "capacity": 4,
    "status": "OCCUPIED",
    "current_order_id": "ord-uuid",
    "current_order_number": "ORD-001",
    "customer_count": 4,
    "recent_orders": [
      {
        "id": "ord-uuid",
        "order_number": "ORD-001",
        "status": "COMPLETED",
        "total_amount": 450.00,
        "created_at": "2026-06-18T10:00:00Z"
      }
    ]
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

---

## 3. MENU APIs (4 endpoints)

### 3.1 Get Complete Menu
```http
GET /menus
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cat-001",
        "name": "Beverages",
        "description": "Hot and cold drinks",
        "display_order": 1,
        "items": [
          {
            "id": "item-001",
            "name": "Latte",
            "description": "Espresso with steamed milk",
            "price": 120.00,
            "prep_time_minutes": 5,
            "modifier_groups": [
              {
                "id": "mod-grp-001",
                "name": "Size",
                "selection_type": "single",
                "min_select": 1,
                "max_select": 1,
                "options": [
                  { "id": "opt-001", "name": "Small", "price_adjustment": 0 },
                  { "id": "opt-002", "name": "Medium", "price_adjustment": 20 },
                  { "id": "opt-003", "name": "Large", "price_adjustment": 40 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 3.2 Get Menu Categories
```http
GET /menus/categories
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cat-001",
        "name": "Beverages",
        "description": "Hot and cold drinks",
        "display_order": 1
      },
      {
        "id": "cat-002",
        "name": "Pastries",
        "description": "Fresh baked items",
        "display_order": 2
      }
    ]
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 3.3 Get Items in Category
```http
GET /menus/categories/{categoryId}/items
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "category_id": "cat-001",
    "category_name": "Beverages",
    "items": [
      {
        "id": "item-001",
        "name": "Latte",
        "price": 120.00,
        "prep_time_minutes": 5
      }
    ]
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 3.4 Get Specific Menu Item
```http
GET /menus/items/{itemId}
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "id": "item-001",
    "name": "Latte",
    "description": "Espresso with steamed milk",
    "price": 120.00,
    "prep_time_minutes": 5,
    "is_vegetarian": true,
    "modifier_groups": [
      {
        "id": "mod-grp-001",
        "name": "Size",
        "selection_type": "single",
        "min_select": 1,
        "max_select": 1,
        "options": [
          { "id": "opt-001", "name": "Small", "price_adjustment": 0 },
          { "id": "opt-002", "name": "Medium", "price_adjustment": 20 }
        ]
      }
    ]
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

---

## 4. ORDER MANAGEMENT APIs (5 endpoints)

### 4.1 Create New Order
```http
POST /orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "table_id": "tbl-001",
  "special_instructions": "No onions",
  "items": [
    {
      "menu_item_id": "item-001",
      "quantity": 2,
      "special_instructions": "Extra hot",
      "modifiers": [
        { "modifier_option_id": "opt-002" }
      ]
    },
    {
      "menu_item_id": "item-003",
      "quantity": 1,
      "modifiers": []
    }
  ]
}

Response (201):
{
  "success": true,
  "data": {
    "id": "ord-uuid",
    "order_number": "ORD-001",
    "table_id": "tbl-001",
    "table_number": 1,
    "status": "CREATED",
    "subtotal": 410.00,
    "tax": 40.00,
    "total_amount": 450.00,
    "items": [
      {
        "id": "oi-001",
        "menu_item_name": "Latte",
        "quantity": 2,
        "unit_price": 120.00,
        "status": "PENDING",
        "modifiers": [
          { "name": "Medium", "price_adjustment": 20 }
        ]
      }
    ],
    "created_at": "2026-06-18T10:30:00Z"
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### 4.2 Get Order Details
```http
GET /orders/{orderId}
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "id": "ord-uuid",
    "order_number": "ORD-001",
    "status": "PREPARING",
    "total_amount": 450.00,
    "items": [
      {
        "id": "oi-001",
        "menu_item_name": "Latte",
        "quantity": 2,
        "status": "PREPARING",
        "unit_price": 120.00
      },
      {
        "id": "oi-002",
        "menu_item_name": "Croissant",
        "quantity": 1,
        "status": "DONE",
        "unit_price": 60.00
      }
    ],
    "created_at": "2026-06-18T10:30:00Z",
    "updated_at": "2026-06-18T10:40:00Z"
  },
  "timestamp": "2026-06-18T10:40:00Z"
}
```

### 4.3 List Orders (with filters)
```http
GET /orders?status=PREPARING&limit=10&offset=0
Authorization: Bearer {token}

Query Parameters:
- status: CREATED | ACCEPTED | PREPARING | READY | COMPLETED | CANCELLED
- limit: number (default: 10)
- offset: number (default: 0)
- table_id: string (optional)

Response (200):
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord-uuid",
        "order_number": "ORD-001",
        "table_number": 1,
        "status": "PREPARING",
        "total_amount": 450.00,
        "item_count": 3,
        "created_at": "2026-06-18T10:30:00Z"
      }
    ],
    "total": 5,
    "limit": 10,
    "offset": 0
  },
  "timestamp": "2026-06-18T10:40:00Z"
}
```

### 4.4 Update Order Status
```http
PATCH /orders/{orderId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "READY"
}

Valid Transitions:
- CREATED → ACCEPTED, CANCELLED
- ACCEPTED → PREPARING, CANCELLED
- PREPARING → READY, CANCELLED
- READY → COMPLETED, CANCELLED

Response (200):
{
  "success": true,
  "data": {
    "id": "ord-uuid",
    "order_number": "ORD-001",
    "status": "READY",
    "message": "Order status updated to READY",
    "updated_at": "2026-06-18T10:45:00Z"
  },
  "timestamp": "2026-06-18T10:45:00Z"
}
```

### 4.5 Add Items to Existing Order
```http
POST /orders/{orderId}/items
Authorization: Bearer {token}
Content-Type: application/json

{
  "items": [
    {
      "menu_item_id": "item-002",
      "quantity": 1,
      "special_instructions": "No sugar",
      "modifiers": []
    }
  ]
}

Response (200):
{
  "success": true,
  "data": {
    "id": "ord-uuid",
    "order_number": "ORD-001",
    "status": "PREPARING",
    "total_amount": 539.00,
    "items": [
      // All items including newly added
    ],
    "message": "1 item added to order",
    "updated_at": "2026-06-18T10:50:00Z"
  },
  "timestamp": "2026-06-18T10:50:00Z"
}
```

---

## 5. PAYMENT APIs (3 endpoints)

### 5.1 Create Payment
```http
POST /payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "order_id": "ord-uuid",
  "amount": 450.00,
  "payment_method": "CASH" | "CARD",
  "is_partial": false,
  "notes": "Customer paid in cash"
}

Response (201):
{
  "success": true,
  "data": {
    "id": "pay-uuid",
    "order_id": "ord-uuid",
    "order_number": "ORD-001",
    "amount": 450.00,
    "payment_method": "CASH",
    "status": "COMPLETED",
    "created_at": "2026-06-18T10:55:00Z"
  },
  "timestamp": "2026-06-18T10:55:00Z"
}
```

### 5.2 Get Payment Details
```http
GET /payments/{paymentId}
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "id": "pay-uuid",
    "order_id": "ord-uuid",
    "order_number": "ORD-001",
    "amount": 450.00,
    "payment_method": "CASH",
    "status": "COMPLETED",
    "transaction_id": null,
    "created_at": "2026-06-18T10:55:00Z"
  },
  "timestamp": "2026-06-18T10:55:00Z"
}
```

### 5.3 List Payments for Order
```http
GET /orders/{orderId}/payments
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "order_id": "ord-uuid",
    "order_total": 450.00,
    "payments": [
      {
        "id": "pay-uuid",
        "amount": 450.00,
        "payment_method": "CASH",
        "status": "COMPLETED",
        "created_at": "2026-06-18T10:55:00Z"
      }
    ],
    "total_paid": 450.00,
    "balance": 0.00,
    "payment_complete": true
  },
  "timestamp": "2026-06-18T10:55:00Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": "Additional context"
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| INVALID_CREDENTIALS | 401 | Email/password not found |
| TOKEN_EXPIRED | 401 | Access token expired |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource doesn't exist |
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_TRANSITION | 400 | Invalid state change |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## WebSocket Real-Time Events

**Connection**:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: accessToken }
});

socket.emit('join_restaurant', { restaurant_id: restaurantId });
```

**Listen Events**:
```javascript
socket.on('ORDER_CREATED', (data) => { /* ... */ });
socket.on('ORDER_UPDATED', (data) => { /* ... */ });
socket.on('ORDER_READY', (data) => { /* ... */ });
socket.on('ORDER_COMPLETED', (data) => { /* ... */ });
socket.on('ORDER_CANCELLED', (data) => { /* ... */ });
socket.on('ORDER_DELAYED', (data) => { /* ... */ });
socket.on('PAYMENT_CREATED', (data) => { /* ... */ });
socket.on('PAYMENT_COMPLETED', (data) => { /* ... */ });
socket.on('TABLE_OCCUPIED', (data) => { /* ... */ });
socket.on('TABLE_FREED', (data) => { /* ... */ });
socket.on('INVENTORY_LOW_STOCK', (data) => { /* ... */ });
socket.on('INVENTORY_UPDATED', (data) => { /* ... */ });
```

---

## HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Permission denied |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error - Server error |

---

## Rate Limiting

- **Auth Endpoints**: 10 requests per minute
- **Other Endpoints**: 100 requests per minute
- **WebSocket**: No rate limit

---

## Complete Summary

| Category | Count | Endpoints |
|----------|-------|-----------|
| Authentication | 3 | Login, Refresh Token, Get User |
| Tables | 3 | List, With Status, Details |
| Menu | 4 | Complete, Categories, Items, Item Details |
| Orders | 5 | Create, Get, List, Update Status, Add Items |
| Payments | 3 | Create, Get, List by Order |
| **Total** | **18** | **All REST endpoints** |
| WebSocket Events | 12+ | Real-time updates |

---

## Testing Tools

- **Postman Collection**: Available in `/waiter-app-specs/postman_collection.json`
- **JSON Examples**: Available in `/waiter-app-specs/json-examples/`
- **Backend**: http://localhost:3000 (development)

---

**Last Updated**: June 18, 2026
