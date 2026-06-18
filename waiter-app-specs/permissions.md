# Waiter App Permissions & Capabilities

## Overview

The Waiter App enforces role-based access control (RBAC). Different user roles have different capabilities. This document outlines what waiters can and cannot do.

---

## User Roles in AuraOS

| Role | Purpose | Can Access Waiter App? |
|------|---------|---------------------|
| **ADMIN** | Restaurant owner/manager | Yes (full access + management) |
| **WAITER** | Table server | Yes (core operations only) |
| **RECEPTION** | Front desk/reservations | Limited (not core waiter features) |
| **KITCHEN** | Kitchen staff | Limited (cooking only) |

---

## WAITER Role Permissions

### ✅ What Waiters CAN Do

#### 1. Authentication & Profile
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - View own profile
- `POST /auth/logout` - Logout

**Use Case**: Waiter logs in, app refreshes token on app start, waiter can see their profile

---

#### 2. View Tables
- `GET /tables` - List all tables in restaurant
- `GET /tables/with-status` - See which tables are occupied
- `GET /tables/:id` - View specific table details

**Data Returned**:
```json
{
  "id": "table-uuid",
  "table_number": "T1",
  "seats": 4,
  "is_active": true,
  "active_order_id": "order-uuid or null"
}
```

**Use Case**: Waiter sees table layout, can tell which tables are free/busy

**Restrictions**:
- ❌ Cannot create tables
- ❌ Cannot modify tables
- ❌ Cannot delete tables

---

#### 3. View Menu
- `GET /menus` - Get complete restaurant menu
- `GET /menus/categories` - Get menu categories
- `GET /menus/categories/:id` - View specific category
- `GET /menus/items` - Get all menu items
- `GET /menus/items/:id` - View specific item with modifiers

**Data Returned**:
```json
{
  "id": "item-uuid",
  "name": "Latte",
  "price": 120.00,
  "description": "Classic coffee drink",
  "modifier_groups": [
    {
      "id": "group-uuid",
      "name": "Size",
      "selection_type": "single",
      "options": [
        {"id": "opt-uuid", "name": "Small", "price_adjustment": 0},
        {"id": "opt-uuid", "name": "Large", "price_adjustment": 30}
      ]
    }
  ]
}
```

**Use Case**: Waiter can show menu to customer on app, explain options and modifiers

**Restrictions**:
- ❌ Cannot add menu items
- ❌ Cannot modify prices
- ❌ Cannot delete items

---

#### 4. Create Orders
- `POST /orders` - Create new order

**Required Body**:
```json
{
  "table_id": "table-uuid",
  "order_type": "DINE_IN",
  "order_source": "WAITER",
  "items": [
    {
      "menu_item_id": "item-uuid",
      "quantity": 2,
      "special_instructions": "No onions",
      "modifiers": [
        {"modifier_option_id": "opt-uuid"}
      ]
    }
  ]
}
```

**Use Case**: Waiter takes order from customer at table, sends to kitchen

---

#### 5. View Orders
- `GET /orders` - List all orders in restaurant
- `GET /orders/:id` - View specific order details
- `GET /orders/active/by-table/:tableId` - Check if table has open order

**Data Includes**: Order items, status, table, timestamps

**Use Case**: Waiter checks order history, sees running orders, finds existing order for table

---

#### 6. Update Order Status
- `PATCH /orders/:id` - Update order status

**Allowed Status Transitions**:
```
CREATED → ACCEPTED (waiter confirms to kitchen)
         ↓
    PREPARING (kitchen starts)
         ↓
       READY (food is ready)
         ↓
    COMPLETED (after payment)
    
    OR CANCELLED (anytime)
```

**Request**:
```json
{
  "status": "READY"
}
```

**Use Case**: Waiter marks order as accepted when kitchen confirms, marks ready when food arrives

---

#### 7. Add Items to Existing Order
- `POST /orders/:id/items` - Add dishes to open order

**Request**:
```json
{
  "items": [
    {
      "menu_item_id": "item-uuid",
      "quantity": 1
    }
  ]
}
```

**Use Case**: Customer adds another round of drinks; waiter appends to existing order

---

#### 8. Create Payments
- `POST /payments` - Create payment for order

**Request**:
```json
{
  "order_id": "order-uuid",
  "amount": 450.00,
  "method": "CASH",
  "reference_number": "CARD123456"
}
```

**Use Case**: Waiter collects payment (cash, card, UPI), records in system

---

#### 9. View Payments
- `GET /payments` - List all payments
- `GET /payments/:id` - View payment details

**Use Case**: Waiter can see payment history for auditing

---

#### 10. Receive Real-Time Notifications
- `socket.on('ORDER_CREATED')` - New order created
- `socket.on('ORDER_UPDATED')` - Order status changed
- `socket.on('ORDER_READY')` - Food is ready
- `socket.on('PAYMENT_COMPLETED')` - Payment received
- `socket.on('TABLE_OCCUPIED')` - Table now occupied
- `socket.on('TABLE_FREED')` - Table is available
- `socket.on('INVENTORY_LOW_STOCK')` - Item out of stock

**Use Case**: Waiter gets live notifications on phone while working

---

### ❌ What Waiters CANNOT Do

#### Restaurant Management
- ❌ View restaurant settings
- ❌ Modify restaurant details
- ❌ Access analytics/reports
- ❌ View revenue/payments reports

**Rationale**: Financial and operational decisions are manager-only

---

#### User Management
- ❌ Create new staff users
- ❌ Modify user roles
- ❌ Change other users' passwords
- ❌ Deactivate users
- ❌ View user list

**Rationale**: Staff administration is admin-only

---

#### Menu Management
- ❌ Add menu items
- ❌ Modify prices
- ❌ Delete items
- ❌ Create categories
- ❌ Configure modifiers

**Rationale**: Menu structure is admin-only

---

#### Table Management
- ❌ Create tables
- ❌ Modify table settings
- ❌ Delete tables
- ❌ Merge/split tables

**Rationale**: Table layout is admin-only

---

#### Inventory Management
- ❌ View inventory levels
- ❌ Update stock counts
- ❌ Set reorder levels
- ❌ Mark items out of stock

**Rationale**: Inventory is typically kitchen manager or separate system

---

#### Payment Management
- ❌ Modify payment status after creation
- ❌ Issue refunds
- ❌ View payment reports
- ❌ Access payment gateway settings

**Rationale**: Financial transactions are audited; only admins can refund

---

#### Order Cancellation
- ❌ Delete orders (orders are immutable)
- ❌ Modify completed orders

**Rationale**: Audit trail and order history must be preserved

---

#### Integration Management
- ❌ Configure Zomato integration
- ❌ Set up WhatsApp messaging
- ❌ Manage QR codes

**Rationale**: Integrations are one-time setup by admins

---

## API-Level Access Control

### Authorization Middleware

Every protected endpoint checks the user's role:

```typescript
// Example: Create order endpoint
router.post('/', authenticate, checkSubscription, 
  (req, res, next) => ordersController.create(req, res, next));

// The authenticate middleware:
// 1. Extracts JWT token from header
// 2. Verifies signature and expiry
// 3. Attaches user info to req.user
// 4. Checks if user is active

// The authorize middleware (if needed):
// authorize('KITCHEN', 'ADMIN')  // Only these roles allowed
```

### Tenant Isolation

Even if a waiter somehow bypassed role checks, they CANNOT access another restaurant's data:

```typescript
// Service layer ALWAYS checks restaurantId
const restaurantId = req.user?.restaurantId;  // From JWT
if (!restaurantId) throw new Error('Not associated with restaurant');

// Query includes restaurant filter
const orders = await db.query(
  'SELECT * FROM orders WHERE restaurant_id = $1 AND ...',
  [restaurantId]
);
```

---

## Capability Matrix

| Capability | WAITER | KITCHEN | RECEPTION | ADMIN |
|-----------|--------|---------|-----------|-------|
| **Authentication** | ✅ | ✅ | ✅ | ✅ |
| **View tables** | ✅ | ❌ | ✅ | ✅ |
| **View menu** | ✅ | ❌ | ✅ | ✅ |
| **Create order** | ✅ | ❌ | ✅ | ✅ |
| **View orders** | ✅ | ✅ | ✅ | ✅ |
| **Update order status** | ✅ | ✅ | ❌ | ✅ |
| **Update item status** | ❌ | ✅ | ❌ | ✅ |
| **Create payment** | ✅ | ❌ | ✅ | ✅ |
| **View payments** | ✅ | ❌ | ✅ | ✅ |
| **Manage menu** | ❌ | ❌ | ❌ | ✅ |
| **Manage tables** | ❌ | ❌ | ❌ | ✅ |
| **Manage users** | ❌ | ❌ | ❌ | ✅ |
| **View reports** | ❌ | ❌ | ❌ | ✅ |
| **Manage inventory** | ❌ | ❌ | ❌ | ✅ |

---

## Real-Time Notification Access

### Waiters receive:
- ✅ `ORDER_CREATED` - New order placed
- ✅ `ORDER_UPDATED` - Order status changed
- ✅ `ORDER_READY` - Food ready for pickup
- ✅ `ORDER_DELAYED` - Order exceeds SLA
- ✅ `PAYMENT_COMPLETED` - Payment received
- ✅ `TABLE_OCCUPIED` - Table marked occupied
- ✅ `TABLE_FREED` - Table available
- ✅ `INVENTORY_LOW_STOCK` - Item unavailable

### Waiters CANNOT subscribe to:
- ❌ Restaurant settings changes
- ❌ User management events
- ❌ Menu edit events
- ❌ System admin events

---

## HTTP Status Codes for Permission Errors

### 401 Unauthorized
User not authenticated (missing/invalid token)
```json
{
  "error": {
    "message": "Invalid token",
    "code": "UNAUTHORIZED"
  }
}
```

### 403 Forbidden
User authenticated but doesn't have permission
```json
{
  "error": {
    "message": "WAITER role cannot access this endpoint",
    "code": "FORBIDDEN"
  }
}
```

### 404 Not Found
Resource doesn't exist (or user can't see it due to tenant isolation)
```json
{
  "error": {
    "message": "Order not found",
    "code": "NOT_FOUND"
  }
}
```

---

## Security Best Practices

### 1. Token Storage (Client-Side)
```typescript
// ✅ GOOD: Secure enclave (React Native AsyncStorage with encryption)
await SecureStore.setItemAsync('token', accessToken);

// ❌ BAD: Plain text localStorage
localStorage.setItem('token', accessToken);
```

### 2. Token Refresh
```typescript
// ✅ GOOD: Refresh proactively before expiry
useEffect(() => {
  if (shouldRefreshToken()) {
    refreshAccessToken();
  }
}, []);

// ❌ BAD: Wait for 401 error, then refresh
```

### 3. Logout
```typescript
// ✅ GOOD: Clear token immediately
SecureStore.deleteItemAsync('token');
socket.disconnect();

// ❌ BAD: Keep token in memory
```

### 4. HTTPS Only
```typescript
// ✅ GOOD: Always use HTTPS in production
const API_URL = 'https://api.auraos.local/api/v1';

// ❌ BAD: HTTP exposes token in transit
const API_URL = 'http://api.auraos.local/api/v1';
```

---

## Error Scenarios & Handling

### Scenario 1: Waiter tries to access admin endpoint

**Request**:
```
GET /api/v1/restaurants/stats
Authorization: Bearer eyJ...
```

**Response** (403 Forbidden):
```json
{
  "success": false,
  "error": {
    "message": "WAITER role is not authorized for this action",
    "code": "FORBIDDEN"
  }
}
```

**Waiter App Response**: Show error toast, hide button

---

### Scenario 2: Waiter's token expires

**Request**:
```
POST /api/v1/orders
Authorization: Bearer <expired-token>
```

**Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "message": "Token has expired",
    "code": "UNAUTHORIZED"
  }
}
```

**Waiter App Response**: 
1. Try to refresh token
2. If refresh succeeds → retry request
3. If refresh fails → redirect to login

---

### Scenario 3: Waiter tries to access another restaurant's order

**Request**:
```
GET /api/v1/orders/order-uuid
Authorization: Bearer <token-for-restaurant-A>
// But order-uuid belongs to restaurant-B
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": {
    "message": "Order not found",
    "code": "NOT_FOUND"
  }
}
```

**Note**: Returns 404 (not 403) to avoid leaking tenant information

---

## API Endpoint Permission Summary

| Endpoint | Method | Required Role | Purpose |
|----------|--------|---------------|---------|
| /auth/login | POST | None | Login |
| /auth/refresh | POST | None | Refresh token |
| /auth/me | GET | Any | Get profile |
| /auth/logout | POST | Any | Logout |
| /tables | GET | WAITER+ | List tables |
| /menus | GET | WAITER+ | Get menu |
| /orders | POST | WAITER+ | Create order |
| /orders | GET | WAITER+ | List orders |
| /orders/:id | GET | WAITER+ | View order |
| /orders/:id | PATCH | WAITER+ | Update order |
| /orders/:id/items | POST | WAITER+ | Add items |
| /payments | POST | WAITER+ | Create payment |
| /payments | GET | WAITER+ | List payments |

**Note**: "WAITER+" means WAITER, RECEPTION, ADMIN roles (any staff)

---

## Development Tips

### Testing Permissions

```bash
# Get WAITER token
TOKEN_WAITER=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -d '{"email":"waiter@restaurant.local","password":"demo123"}' \
  | jq -r '.data.token')

# Try admin endpoint (should fail)
curl -X GET http://localhost:3000/api/v1/restaurants/stats \
  -H "Authorization: Bearer $TOKEN_WAITER"
# Response: 403 Forbidden

# Try waiter endpoint (should succeed)
curl -X GET http://localhost:3000/api/v1/tables \
  -H "Authorization: Bearer $TOKEN_WAITER"
# Response: 200 OK
```

### Implementing RBAC in React Native

```typescript
import { useAuth } from './AuthContext';

export const useCanAccess = (requiredRoles: string[]) => {
  const { user } = useAuth();
  return user && requiredRoles.includes(user.role);
};

// Usage:
export const OrderScreen = () => {
  const canCreateOrder = useCanAccess(['WAITER', 'RECEPTION', 'ADMIN']);
  
  return (
    <>
      {canCreateOrder && <CreateOrderButton />}
      <OrdersList />
    </>
  );
};
```

---

## Summary

**Waiters are restricted to core operations:**
- Take orders from customers
- Manage running orders
- Process payments
- View menu and tables

**Waiters cannot:**
- Manage restaurant settings
- Create/manage staff
- Edit menu/tables
- Access analytics
- Process refunds

This design ensures operational simplicity while maintaining security and audit trails.
