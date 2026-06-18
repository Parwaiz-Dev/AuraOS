# JSON Examples

This folder contains comprehensive request/response examples for all Waiter App API endpoints and WebSocket events.

## Files

### 1. `auth-examples.json`
Authentication flow examples:
- **Login**: POST `/api/v1/auth/login` - Get access token and refresh token
- **Refresh Token**: POST `/api/v1/auth/refresh` - Get new access token
- **Get Profile**: GET `/api/v1/auth/me` - Get current user information

**Key Fields**:
- `token`: JWT access token (15-minute expiry)
- `refreshToken`: JWT refresh token (7-day expiry)
- `user`: Current user object with role and restaurant_id

---

### 2. `menu-examples.json`
Menu and menu item examples:
- **Get Complete Menu**: GET `/api/v1/menus` - All categories, items, and modifiers
- **Get Menu Item**: GET `/api/v1/menus/items/{id}` - Single item with modifier details

**Key Data**:
- Menu organized by categories
- Items with prices and prep times
- Modifier groups (Size, Milk Type, Extras) with:
  - `selection_type`: "single" or "multiple"
  - `min_select`/`max_select`: Validation rules
  - Options with price adjustments

**Usage**: Fully cacheable (safe to store locally with 1-hour TTL)

---

### 3. `tables-examples.json`
Table management examples:
- **List Tables**: GET `/api/v1/tables` - All restaurant tables
- **Tables with Status**: GET `/api/v1/tables/with-status` - Real-time table status
- **Get Table Details**: GET `/api/v1/tables/{id}` - Specific table with order history

**Key Fields**:
- `status`: "VACANT", "OCCUPIED", or "RESERVED"
- `current_order_id`: Active order on table
- `customer_count`: Number of seated guests
- `recent_orders`: Last 2 orders at table

**Usage**: Refresh on app open, subscribe to TABLE_OCCUPIED/TABLE_FREED events

---

### 4. `orders-examples.json`
Order creation and management examples:
- **Create Order**: POST `/api/v1/orders` - Create new order with items
- **Get Order**: GET `/api/v1/orders/{id}` - Full order details
- **Add Items**: POST `/api/v1/orders/{id}/items` - Add items to existing order
- **Update Status**: PATCH `/api/v1/orders/{id}` - Change order status
- **List Orders**: GET `/api/v1/orders?status=PREPARING` - Filtered order list

**Key Concepts**:
- Items have independent status: PENDING → PREPARING → DONE
- Order status depends on slowest item
- Each order item can have modifiers with price adjustments
- `special_instructions`: Free-text notes for kitchen

**Workflow**:
1. Create order with initial items
2. Kitchen accepts (status: ACCEPTED)
3. Kitchen starts cooking (status: PREPARING, item statuses update)
4. All items done (status: READY)
5. Waiter collects payment (status: COMPLETED)

---

### 5. `payments-examples.json`
Payment processing examples:
- **Create Payment**: POST `/api/v1/payments` - Process payment
- **Get Payment**: GET `/api/v1/payments/{id}` - Payment details
- **List Payments**: GET `/api/v1/orders/{id}/payments` - Multiple payments for order

**Payment Methods**:
- CASH: Direct cash payment
- CARD: Debit/credit card with transaction tracking
- Other methods may vary by configuration

**Partial Payments**:
- Set `is_partial: true` for installment payments
- Track `pending_amount` for balance due
- Complete when `pending_amount: 0`

---

### 6. `error-examples.json`
Error response patterns for all scenarios:
- Authentication errors (401, invalid credentials)
- Authorization errors (403, insufficient permissions)
- Validation errors (400, missing fields)
- Not found errors (404, resource missing)
- Conflict errors (409, duplicate resource)
- Rate limit errors (429, too many requests)
- Server errors (500, unexpected issue)

**Error Structure**:
```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": "Additional context"
  },
  "timestamp": "ISO-8601 timestamp"
}
```

**Common Error Codes**:
- `INVALID_CREDENTIALS`: Login failed
- `TOKEN_EXPIRED`: Token needs refresh
- `FORBIDDEN`: User lacks permissions
- `INVALID_TRANSITION`: Invalid order status change
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

### 7. `socket-events-examples.json`
Real-time WebSocket events for order tracking:

**Connection Events**:
- Join restaurant room to receive updates
- JWT authentication during handshake
- Automatic reconnection with exponential backoff

**Order Events**:
- `ORDER_CREATED`: New order placed
- `ORDER_UPDATED`: Status changed
- `ORDER_READY`: All items done, ready for pickup
- `ORDER_COMPLETED`: Payment collected
- `ORDER_CANCELLED`: Order cancelled
- `ORDER_DELAYED`: Exceeded SLA threshold

**Payment Events**:
- `PAYMENT_CREATED`: Payment initiated
- `PAYMENT_COMPLETED`: Payment successful

**Table Events**:
- `TABLE_OCCUPIED`: Customer seated
- `TABLE_FREED`: Table cleaned and available

**Inventory Events**:
- `INVENTORY_LOW_STOCK`: Stock below threshold
- `INVENTORY_UPDATED`: Stock level changed

**Broadcast Rooms**:
- `restaurant:{restaurantId}` - All events for restaurant
- `order:{orderNumber}` - Specific order updates

---

## Using These Examples

### In Postman

1. Import the environment variables:
   - `{{base_url}}` = `http://localhost:3000/api/v1`
   - `{{token}}` = JWT from login response
   - `{{restaurant_id}}` = From user profile

2. Copy request bodies from JSON files
3. Use response examples for testing

### In Code (React Native)

```typescript
// Login example
const loginResponse = {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: { id, email, role, restaurantId }
};

// Create order example
const orderRequest = {
  table_id: "tbl-001",
  items: [
    {
      menu_item_id: "item-001",
      quantity: 2,
      modifiers: [{ modifier_option_id: "mod-opt-002" }]
    }
  ]
};
```

### In Testing

```typescript
// Validate response structure
expect(orderResponse).toMatchObject({
  success: true,
  data: {
    id: expect.any(String),
    order_number: expect.stringMatching(/^ORD-\d+/),
    status: "CREATED",
    items: expect.arrayContaining([
      expect.objectContaining({
        menu_item_name: expect.any(String),
        quantity: expect.any(Number)
      })
    ])
  }
});
```

---

## Field Reference

### Order Status Values
- `CREATED`: Order placed, awaiting kitchen
- `ACCEPTED`: Kitchen acknowledged
- `PREPARING`: Items being cooked
- `READY`: All items done, ready for pickup
- `COMPLETED`: Payment collected
- `CANCELLED`: Order cancelled

### Item Status Values
- `PENDING`: Queued for kitchen
- `PREPARING`: Currently cooking
- `DONE`: Finished cooking

### Table Status Values
- `VACANT`: Available for customers
- `OCCUPIED`: Customer seated with active order
- `RESERVED`: Reserved for future time

### User Roles
- `ADMIN`: Restaurant owner/manager
- `WAITER`: Server (order creation, payments)
- `RECEPTION`: Front desk staff
- `KITCHEN`: Cook staff

### HTTP Status Codes
- `200 OK`: Successful GET/PATCH
- `201 CREATED`: Successful POST
- `400 Bad Request`: Validation or business logic error
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected error

---

## Testing Workflow

1. **Authenticate**:
   - POST `/auth/login` with valid credentials
   - Store `token` and `refreshToken`

2. **Get Menu**:
   - GET `/menus`
   - Cache locally for 1 hour

3. **View Tables**:
   - GET `/tables/with-status`
   - Real-time status from response

4. **Create Order**:
   - POST `/orders` with table_id and items
   - Track order_number from response

5. **Subscribe to Events**:
   - Connect WebSocket with JWT auth
   - Emit `join_restaurant`
   - Listen for `ORDER_UPDATED`, `ORDER_READY` events

6. **Process Payment**:
   - POST `/payments` with order_id and amount
   - Verify `status: COMPLETED`

7. **Verify Analytics**:
   - Query orders by status
   - Confirm payment collected

---

## Troubleshooting

**Invalid token error?**
- Check token expiry (15 minutes)
- Use refresh token to get new access token
- Ensure JWT is in `Authorization: Bearer` header

**Order not found?**
- Verify order belongs to your restaurant (RLS)
- Check order_id matches UUID format
- Order must be created after token issued

**Rate limited?**
- Maximum 10 login attempts per minute
- Wait before retrying
- Check `Retry-After` header for wait time

**Payment failed?**
- Verify amount ≤ order total
- Check payment method is valid
- Ensure order status permits payment

---

## Next Steps

1. Import examples into Postman
2. Test each endpoint with example data
3. Verify response structure matches examples
4. Implement error handling for error scenarios
5. Subscribe to WebSocket events for real-time updates
6. Build offline caching around menu and table examples
