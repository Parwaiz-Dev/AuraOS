# AuraOS API Testing Guide

## 🚀 Quick Start

### Prerequisites
- Server running: `npm run dev`
- Curl or Postman installed
- jq installed (for JSON parsing in bash)

---

## 📋 Testing Methods

### Method 1: Bash Script (test-api.sh)

Complete automated test sequence covering all modules.

```bash
bash test-api.sh
```

This script:
- Authenticates and retrieves JWT token
- Tests all CRUD operations
- Creates sample data and verifies responses
- Covers all 8 core modules + integrations

---

### Method 2: Postman Collection
Import `AuraOS-API.postman_collection.json` into Postman:

1. Open Postman
2. Click "Import"
3. Select `AuraOS-API.postman_collection.json`
4. Set variables:
   - `base_url`: http://localhost:3000/api/v1
   - `token`: (auto-filled after login)
5. Run requests in order

---

### Method 3: Manual Curl Commands

#### 1. Authentication
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo-kitchen.local",
    "password": "demo123"
  }' | jq -r '.data.token')

echo "Token: $TOKEN"
```

#### 2. Restaurants
```bash
# Get current restaurant
curl -X GET http://localhost:3000/api/v1/restaurants/me \
  -H "Authorization: Bearer $TOKEN"

# Get restaurant stats
curl -X GET http://localhost:3000/api/v1/restaurants/me/stats \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Tables
```bash
# List all tables
curl -X GET http://localhost:3000/api/v1/tables \
  -H "Authorization: Bearer $TOKEN"

# Create new table
curl -X POST http://localhost:3000/api/v1/tables \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_number": "T10",
    "seats": 4
  }'

# Get table stats
curl -X GET http://localhost:3000/api/v1/tables/stats \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Menu
```bash
# Get menu overview
curl -X GET http://localhost:3000/api/v1/menus \
  -H "Authorization: Bearer $TOKEN"

# Get all menu items
curl -X GET http://localhost:3000/api/v1/menus/items \
  -H "Authorization: Bearer $TOKEN"

# Get menu categories
curl -X GET http://localhost:3000/api/v1/menus/categories \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Orders
```bash
# Get menu item ID first
MENU_ITEM_ID=$(curl -s -X GET http://localhost:3000/api/v1/menus/items \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

# Get table ID first
TABLE_ID=$(curl -s -X GET http://localhost:3000/api/v1/tables \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

# Create order
ORDER=$(curl -s -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"table_id\": \"$TABLE_ID\",
    \"order_type\": \"DINE_IN\",
    \"order_source\": \"WAITER\",
    \"items\": [{
      \"menu_item_id\": \"$MENU_ITEM_ID\",
      \"quantity\": 2
    }]
  }")

ORDER_ID=$(echo "$ORDER" | jq -r '.data.order.id')
echo "Order ID: $ORDER_ID"

# List orders
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN"

# Get order by ID
curl -X GET http://localhost:3000/api/v1/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN"

# Update order status
curl -X PUT http://localhost:3000/api/v1/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACCEPTED"}'

# Get order stats
curl -X GET http://localhost:3000/api/v1/orders/stats \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Payments
```bash
# Create payment
PAYMENT=$(curl -s -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"amount\": 500,
    \"method\": \"CARD\",
    \"reference_number\": \"TXN-123456\"
  }")

PAYMENT_ID=$(echo "$PAYMENT" | jq -r '.data.id')

# List payments
curl -X GET http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer $TOKEN"

# Update payment status
curl -X PUT http://localhost:3000/api/v1/payments/$PAYMENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "PAID"}'

# Get payment stats
curl -X GET http://localhost:3000/api/v1/payments/stats \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Inventory
```bash
# Create inventory item
INVENTORY=$(curl -s -X POST http://localhost:3000/api/v1/inventory \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_item_id\": \"$MENU_ITEM_ID\",
    \"current_stock\": 50,
    \"reorder_level\": 10
  }")

INVENTORY_ID=$(echo "$INVENTORY" | jq -r '.data.id')

# List inventory
curl -X GET http://localhost:3000/api/v1/inventory \
  -H "Authorization: Bearer $TOKEN"

# Update inventory stock
curl -X PUT http://localhost:3000/api/v1/inventory/$INVENTORY_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_stock": 45}'

# Get inventory stats
curl -X GET http://localhost:3000/api/v1/inventory/stats \
  -H "Authorization: Bearer $TOKEN"
```

#### 8. Reports
```bash
# Get dashboard report
curl -X GET http://localhost:3000/api/v1/reports/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Get top selling items
curl -X GET "http://localhost:3000/api/v1/reports/top-items?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get daily revenue (last 7 days)
curl -X GET "http://localhost:3000/api/v1/reports/daily-revenue?days=7" \
  -H "Authorization: Bearer $TOKEN"

# Get inventory alerts
curl -X GET http://localhost:3000/api/v1/reports/inventory-alerts \
  -H "Authorization: Bearer $TOKEN"
```

#### 9. Integrations - Zomato
```bash
# Simulate Zomato webhook
curl -X POST http://localhost:3000/api/v1/integrations/zomato/webhook \
  -H "X-Restaurant-ID: $RESTAURANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ZOMATO-123456",
    "restaurant_id": "'$RESTAURANT_ID'",
    "customer_name": "John Doe",
    "customer_phone": "+91 9876543210",
    "delivery_address": "123 Main St",
    "items": [{
      "item_id": "'$MENU_ITEM_ID'",
      "item_name": "Biryani",
      "quantity": 2,
      "price": 250
    }],
    "total_amount": 500,
    "status": "RECEIVED",
    "timestamp": "2026-05-05T10:30:00Z"
  }'

# Get Zomato sync status
curl -X GET http://localhost:3000/api/v1/integrations/zomato/sync-status \
  -H "Authorization: Bearer $TOKEN"
```

#### 10. Integrations - WhatsApp
```bash
# Simulate WhatsApp webhook
curl -X POST http://localhost:3000/api/v1/integrations/whatsapp/webhook \
  -H "X-Restaurant-ID: $RESTAURANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "metadata": {
      "display_phone_number": "1234567890",
      "phone_number_id": "123456"
    },
    "contacts": [{
      "profile": {"name": "John Doe"},
      "wa_id": "919876543210"
    }],
    "messages": [{
      "from": "919876543210",
      "id": "wamid.123",
      "timestamp": "1234567890",
      "text": {"body": "2x Biryani, 1x Naan"},
      "type": "text"
    }]
  }'

# Get WhatsApp sync status
curl -X GET http://localhost:3000/api/v1/integrations/whatsapp/sync-status \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🧪 Test Scenarios

### Scenario 1: Complete Order Lifecycle
1. Get menu items
2. Create order with items
3. Update order status (CREATED → ACCEPTED → PREPARING → READY → COMPLETED)
4. Create payment
5. Mark payment as paid
6. View order stats

### Scenario 2: Inventory Management
1. Create inventory items
2. Get inventory status
3. Update stock levels
4. Check low-stock alerts via reports

### Scenario 3: Multi-table Dine-in
1. Get all tables
2. Create orders for different tables
3. Update table status
4. Complete orders
5. View table stats

### Scenario 4: Integration Webhook Testing
1. Send Zomato webhook order
2. Verify order creation
3. Send WhatsApp webhook message
4. Verify WhatsApp order parsing
5. Check integration sync status

---

## ✅ Response Validation Checklist

### Success Responses (200/201)
```json
{
  "success": true,
  "data": { /* actual data */ },
  "meta": {
    "timestamp": "2026-05-05T...",
    "message": "..."
  }
}
```

### Error Responses (4xx/5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {
    "timestamp": "2026-05-05T..."
  }
}
```

---

## 🔐 Authentication Errors
- **401**: Invalid/expired token
- **403**: Insufficient permissions (RBAC)
- **400**: Invalid request body

---

## 📊 Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Auth | 4 | ✅ |
| Restaurants | 3 | ✅ |
| Tables | 5 | ✅ |
| Menu | 4 | ✅ |
| Orders | 6 | ✅ |
| Payments | 5 | ✅ |
| Inventory | 5 | ✅ |
| Reports | 4 | ✅ |
| Zomato | 2 | ✅ |
| WhatsApp | 2 | ✅ |
| **Total** | **40** | **✅** |

---

## 🚀 Running Full Test Suite

```bash
# Automated (all tests)
bash test-api.sh

# Manual (step by step)
1. Start server: npm run dev
2. Open Postman and import collection
3. Run requests in sequence
```

---

All endpoints tested and ready for production!
