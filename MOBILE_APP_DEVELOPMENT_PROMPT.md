# Mobile Waiter App Development Prompt

## Project Overview

Build a **production-grade React Native + Expo mobile waiter application** for the AuraOS restaurant platform. This app enables restaurant staff (waiters, kitchen staff) to manage orders, track tables, process payments, and receive real-time updates from the backend API.

**Key Deliverable**: A fully functional iOS/Android app that replicates the PWA functionality with native mobile capabilities.

---

## Tech Stack

### Required
- **React Native** 0.71+ with TypeScript
- **Expo** 49+ (for easy deployment & updates)
- **Redux Toolkit** (state management)
- **React Navigation** (routing/navigation)
- **Socket.IO Client** (real-time events)
- **Axios** or **Fetch API** (HTTP requests)
- **AsyncStorage** (local caching)
- **NetInfo** (network status)

### Optional but Recommended
- **Redux Persist** (persist Redux state)
- **React Native NetInfo** (detect offline)
- **Notifee** (push notifications)
- **Vector Icons** (UI icons)
- **NativeWind** (Tailwind CSS for React Native)
- **Jest** + **React Native Testing Library** (testing)

### Development Tools
- **VS Code** with React Native extensions
- **Expo CLI** (for testing and building)
- **Android Studio** or **Xcode** (for emulators)
- **Postman** (for API testing)

---

## Backend API Overview

**Base URL**: `http://localhost:3000/api/v1` (development)

### 26 Available Endpoints

#### Authentication (3 endpoints)
```
POST   /auth/login              - Login with credentials
POST   /auth/refresh            - Refresh access token
GET    /auth/me                 - Get current user profile
```

#### Tables (3 endpoints)
```
GET    /tables                  - List all tables
GET    /tables/with-status      - Tables with real-time status
GET    /tables/{id}             - Single table details
```

#### Menu (4 endpoints)
```
GET    /menus                   - Complete menu (all categories, items, modifiers)
GET    /menus/categories        - Menu categories only
GET    /menus/categories/{id}/items - Items in specific category
GET    /menus/items/{id}        - Single item with modifiers
```

#### Orders (5 endpoints)
```
POST   /orders                  - Create new order
GET    /orders                  - List orders (with filters)
GET    /orders/{id}             - Get order details
PATCH  /orders/{id}             - Update order status
POST   /orders/{id}/items       - Add items to existing order
```

#### Payments (5 endpoints)
```
POST   /payments                - Create payment
GET    /payments/{id}           - Get payment details
GET    /orders/{id}/payments    - List payments for order
```

**All responses follow this format**:
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "optional message",
  "timestamp": "ISO-8601"
}
```

---

## Authentication Flow

### 1. Login
```
POST /auth/login
{
  "email": "john@restaurant.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGci...",        // Access token (15 min expiry)
  "refreshToken": "eyJhbGci...",  // Refresh token (7 day expiry)
  "user": {
    "id": "uuid",
    "email": "john@restaurant.com",
    "name": "John Waiter",
    "role": "WAITER",              // WAITER, KITCHEN, RECEPTION, ADMIN
    "restaurant_id": "uuid",
    "is_active": true
  }
}
```

### 2. Store Tokens
```typescript
// Redux store tokens
store.dispatch(setAuthTokens({
  accessToken: response.data.token,
  refreshToken: response.data.refreshToken,
  user: response.data.user
}));

// Also store in AsyncStorage for app persistence
await AsyncStorage.setItem('tokens', JSON.stringify({
  accessToken: response.data.token,
  refreshToken: response.data.refreshToken
}));
```

### 3. API Requests
```typescript
// Add token to all requests
const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 4. Token Refresh
```typescript
// When access token expires (401 response):
POST /auth/refresh
{
  "refreshToken": "eyJhbGci..."
}

// Get new token and retry original request
```

---

## Real-Time WebSocket Events

### Connection
```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken  // JWT authentication
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  // Join restaurant room for updates
  socket.emit('join_restaurant', {
    restaurant_id: restaurantId
  });
});
```

### Listen for Events
```typescript
// Order created
socket.on('ORDER_CREATED', (data) => {
  console.log('New order:', data.order_number);
  dispatch(addOrder(data));
});

// Order ready for pickup
socket.on('ORDER_READY', (data) => {
  console.log('Order ready:', data.order_number);
  playSound('order-ready.mp3');
  showNotification({
    title: `Order ${data.order_number} Ready!`,
    body: `Table ${data.table_number}`
  });
});

// Order status updated
socket.on('ORDER_UPDATED', (data) => {
  dispatch(updateOrderStatus({
    orderId: data.order_id,
    status: data.new_status
  }));
});

// Table status changed
socket.on('TABLE_OCCUPIED', (data) => {
  dispatch(updateTableStatus({
    tableId: data.table_id,
    status: 'OCCUPIED'
  }));
});

// Payment completed
socket.on('PAYMENT_COMPLETED', (data) => {
  dispatch(markOrderCompleted(data.order_id));
});
```

### Event Types
- `ORDER_CREATED` - New order placed
- `ORDER_UPDATED` - Status changed
- `ORDER_READY` - All items cooked, ready for pickup
- `ORDER_COMPLETED` - Payment received
- `ORDER_CANCELLED` - Order cancelled
- `ORDER_DELAYED` - Exceeded SLA time
- `PAYMENT_CREATED` - Payment initiated
- `PAYMENT_COMPLETED` - Payment successful
- `TABLE_OCCUPIED` - Customer seated
- `TABLE_FREED` - Table available
- `INVENTORY_LOW_STOCK` - Stock alert
- `INVENTORY_UPDATED` - Stock changed

---

## Application Architecture

### Redux Store Structure
```typescript
{
  auth: {
    isAuthenticated: boolean,
    user: { id, email, role, restaurant_id },
    accessToken: string,
    refreshToken: string,
    isLoading: boolean,
    error: string | null
  },
  
  tables: {
    list: Array<Table>,
    status: {
      [tableId]: { status: 'VACANT' | 'OCCUPIED' | 'RESERVED', ... }
    },
    selectedTableId: string | null,
    isLoading: boolean
  },
  
  menu: {
    categories: Array<Category>,
    items: Array<MenuItem>,
    modifiers: Array<Modifier>,
    isLoading: boolean,
    lastUpdated: timestamp
  },
  
  orders: {
    list: Array<Order>,
    currentOrder: Order | null,
    details: {
      [orderId]: Order
    },
    isLoading: boolean
  },
  
  cart: {
    items: Array<{ menuItemId, quantity, modifiers, instructions }>,
    selectedTableId: string,
    total: number,
    specialInstructions: string
  },
  
  payments: {
    list: Array<Payment>,
    isPending: boolean,
    lastPayment: Payment | null
  },
  
  network: {
    isOnline: boolean,
    isConnected: boolean
  }
}
```

### Navigation Structure
```typescript
// Main Stack
├─ SplashScreen
├─ AuthStack
│  ├─ LoginScreen
│  └─ RegisterScreen
└─ AppStack (authenticated)
   ├─ DashboardTab
   │  ├─ DashboardScreen
   │  ├─ TablesScreen
   │  └─ OrdersScreen
   ├─ MenuTab
   │  ├─ MenuScreen
   │  └─ MenuItemDetailScreen
   ├─ CartTab
   │  ├─ CartScreen
   │  └─ CheckoutScreen
   ├─ OrdersTab
   │  ├─ RunningOrdersScreen
   │  ├─ OrderDetailScreen
   │  └─ BillingScreen
   ├─ ProfileTab
   │  ├─ ProfileScreen
   │  └─ SettingsScreen
   └─ Modal Stacks
      ├─ CreateOrderModal
      ├─ PaymentModal
      └─ NotificationCenter
```

---

## Screen Specifications (13 Screens)

### 1. Splash Screen
- Show brand logo/animation
- Check if user is authenticated
- Redirect to Login or Dashboard

### 2. Login Screen
- Email + password input fields
- Login button
- "Forgot password" link
- Error messages
- Loading indicator

### 3. Dashboard Screen
- Welcome message (name of waiter)
- Summary cards: active orders, tables occupied, pending payments
- Quick action buttons: new order, view tables, running orders
- Recent orders list
- Real-time notifications area

### 4. Tables Screen
- Grid of restaurant tables
- Color-coded by status: green (vacant), red (occupied), yellow (reserved)
- Table number, capacity, location
- Tap to see details
- Real-time updates via WebSocket

### 5. Table Details Screen
- Table info: number, capacity, location
- Current order (if occupied)
- Recent orders history
- Status: VACANT / OCCUPIED / RESERVED
- Quick actions: create order, view current order

### 6. Menu Screen
- Category tabs/scrollable list
- Menu items in selected category
- Item image, name, description, price
- Search functionality
- Scroll to specific category

### 7. Menu Item Detail Screen
- Item image, name, description
- Price and prep time
- Modifier groups (Size, Milk Type, Extras, etc.)
- Special instructions input
- "Add to Cart" button
- Quantity selector

### 8. Cart Screen
- Items list with quantity, price per item
- Modifiers for each item
- Special instructions display
- Subtotal, tax, total calculation
- "Create Order" button
- "Continue Shopping" button

### 9. Create Order Screen
- Select table
- Review cart items
- Add special instructions
- Order summary (items, total)
- "Confirm Order" button
- Loading state during submission

### 10. Running Orders Screen
- List of orders by status: CREATED, ACCEPTED, PREPARING, READY
- Order number, table, item count, total amount
- Status indicator (with color)
- Tap to view details
- Filter by status
- Real-time status updates

### 11. Order Details Screen
- Order number, table, status
- Items list with individual status (PENDING, PREPARING, DONE)
- Timestamps (created, updated)
- Special instructions
- Order total
- "Ready for Pickup" button (if PREPARING)
- "View Payment" button
- "Cancel Order" button (if allowed)

### 12. Billing Screen
- Order summary
- Itemized list with prices
- Modifiers breakdown
- Subtotal, tax, total
- Payment method selection: CASH, CARD, OTHER
- Amount input (for partial payments)
- Payment confirmation button
- Loading state

### 13. Receipt Screen
- Order details (number, date, time)
- Itemized receipt
- Total amount paid
- Payment method
- "New Order" button
- "Print Receipt" option

---

## Core Features to Implement

### Feature 1: Authentication & Session Management
**What to build:**
- Login form with validation
- Store JWT tokens securely
- Auto-refresh tokens on expiry
- Logout functionality
- Persist user session

**API Used**: `/auth/login`, `/auth/refresh`, `/auth/me`

**Files to create**:
- `src/screens/LoginScreen.tsx`
- `src/redux/slices/authSlice.ts`
- `src/services/authService.ts`
- `src/utils/tokenManager.ts`

---

### Feature 2: View Tables & Status
**What to build:**
- Fetch all tables on screen load
- Display table grid with real-time status
- Show table occupancy, customer count
- Tap to view table details
- Real-time updates via WebSocket

**API Used**: `/tables`, `/tables/with-status`

**WebSocket Events**: `TABLE_OCCUPIED`, `TABLE_FREED`

**Files to create**:
- `src/screens/TablesScreen.tsx`
- `src/screens/TableDetailsScreen.tsx`
- `src/redux/slices/tableSlice.ts`
- `src/components/TableGrid.tsx`

---

### Feature 3: Browse Menu
**What to build:**
- Fetch menu on app open (cache for 1 hour)
- Category tabs/navigation
- Items list in selected category
- Search items by name
- Tap item to see details and modifiers

**API Used**: `/menus`, `/menus/categories`, `/menus/items/{id}`

**Files to create**:
- `src/screens/MenuScreen.tsx`
- `src/screens/MenuItemDetailScreen.tsx`
- `src/redux/slices/menuSlice.ts`
- `src/components/MenuItemCard.tsx`

---

### Feature 4: Shopping Cart & Modifiers
**What to build:**
- Add items to cart with quantity
- Select modifiers (size, milk type, etc.)
- Add special instructions per item
- Edit/remove items
- Calculate total with modifiers

**Files to create**:
- `src/screens/CartScreen.tsx`
- `src/redux/slices/cartSlice.ts`
- `src/components/CartItem.tsx`
- `src/components/ModifierSelector.tsx`

---

### Feature 5: Create & Track Orders
**What to build:**
- Create order with selected table and items
- Display order confirmation
- Fetch order details by ID
- Show item-level status (PENDING, PREPARING, DONE)
- List running orders filtered by status

**API Used**: `/orders`, `/orders/{id}`, `/orders?status=PREPARING`

**WebSocket Events**: `ORDER_CREATED`, `ORDER_UPDATED`, `ORDER_READY`, `ORDER_COMPLETED`

**Files to create**:
- `src/screens/CreateOrderScreen.tsx`
- `src/screens/RunningOrdersScreen.tsx`
- `src/screens/OrderDetailScreen.tsx`
- `src/redux/slices/orderSlice.ts`
- `src/services/orderService.ts`

---

### Feature 6: Real-Time Updates
**What to build:**
- Connect WebSocket on app start
- Listen for order status changes
- Automatic UI updates (no polling)
- High-priority notifications (ORDER_READY)
- Auto-reconnect on disconnect

**WebSocket Events**: All 12+ events

**Files to create**:
- `src/services/socketService.ts`
- `src/middleware/socketMiddleware.ts`
- `src/components/NotificationBanner.tsx`
- `src/utils/soundManager.ts`

---

### Feature 7: Payment Processing
**What to build:**
- Select payment method (CASH, CARD)
- Input amount (full or partial payment)
- Process payment via API
- Show payment confirmation
- Handle failed payments

**API Used**: `/payments`, `/orders/{id}/payments`

**Files to create**:
- `src/screens/BillingScreen.tsx`
- `src/screens/ReceiptScreen.tsx`
- `src/redux/slices/paymentSlice.ts`
- `src/services/paymentService.ts`

---

### Feature 8: Offline Support
**What to build:**
- Cache menu locally (AsyncStorage)
- Detect network status (NetInfo)
- Show offline banner
- Queue actions for offline (optional)
- Sync when reconnected

**Files to create**:
- `src/services/offlineService.ts`
- `src/hooks/useNetworkStatus.ts`
- `src/components/OfflineBanner.tsx`
- `src/utils/cacheManager.ts`

---

## Development Phases

### Phase 1: Setup (Days 1-2)
```
[ ] Create Expo project
[ ] Configure TypeScript
[ ] Set up Redux store
[ ] Set up React Navigation
[ ] Create folder structure
[ ] Configure environment variables
[ ] Set up axios/HTTP client
```

### Phase 2: Authentication (Days 3-5)
```
[ ] Create login screen UI
[ ] Implement login API call
[ ] Store tokens securely
[ ] Set up auth middleware
[ ] Implement token refresh
[ ] Create splash screen
[ ] Redirect logic (authenticated vs not)
```

### Phase 3: Core Features (Days 6-12)
```
[ ] Tables listing with status
[ ] Menu browsing and search
[ ] Shopping cart
[ ] Order creation
[ ] Order tracking (running orders)
[ ] Add items to existing order
```

### Phase 4: Real-Time (Days 13-16)
```
[ ] WebSocket connection
[ ] Event listeners setup
[ ] Order status updates
[ ] Table status updates
[ ] Push notifications
[ ] Sound alerts (ORDER_READY)
```

### Phase 5: Payments & Polish (Days 17-20)
```
[ ] Billing screen
[ ] Payment processing
[ ] Receipt screen
[ ] Error handling
[ ] Loading states
[ ] Validation
```

### Phase 6: Offline & Advanced (Days 21-25)
```
[ ] Menu caching
[ ] Offline detection
[ ] Offline banner
[ ] Sync strategy
[ ] Background sync
[ ] Redux persistence
```

### Phase 7: Testing & Deployment (Days 26-30)
```
[ ] Unit tests
[ ] Integration tests
[ ] E2E testing
[ ] Performance optimization
[ ] Build for iOS
[ ] Build for Android
[ ] Submit to App Store / Google Play
```

---

## Code Examples

### Example 1: Redux Setup
```typescript
// src/redux/store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import orderReducer from './slices/orderSlice';
import menuReducer from './slices/menuSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orders: orderReducer,
    menu: menuReducer,
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Example 2: Login API Call
```typescript
// src/services/authService.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1'
});

export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  
  // Store tokens
  await AsyncStorage.setItem('accessToken', response.data.data.token);
  await AsyncStorage.setItem('refreshToken', response.data.data.refreshToken);
  
  return response.data.data;
};

export const refreshToken = async (refreshToken: string) => {
  const response = await api.post('/auth/refresh', { refreshToken });
  await AsyncStorage.setItem('accessToken', response.data.data.token);
  return response.data.data.token;
};
```

### Example 3: Create Order
```typescript
// src/services/orderService.ts
export const createOrder = async (
  tableId: string,
  items: Array<{ menuItemId: string; quantity: number; modifiers: any[] }>,
  specialInstructions?: string
) => {
  const response = await api.post('/orders', {
    table_id: tableId,
    items,
    special_instructions: specialInstructions
  });
  
  return response.data.data;
};
```

### Example 4: WebSocket Connection
```typescript
// src/services/socketService.ts
import io from 'socket.io-client';

let socket: any;

export const initializeSocket = (token: string, restaurantId: string) => {
  socket = io('http://localhost:3000', {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    socket.emit('join_restaurant', { restaurant_id: restaurantId });
  });

  socket.on('ORDER_READY', (data) => {
    // Handle order ready
    dispatch(showNotification({
      title: `Order ${data.order_number} Ready!`,
      priority: 'high'
    }));
  });

  return socket;
};
```

---

## API Request/Response Examples

### Login Request/Response
```typescript
// Request
POST /api/v1/auth/login
{
  "email": "john@restaurant.com",
  "password": "password123"
}

// Response (200)
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "john@restaurant.com",
      "name": "John",
      "role": "WAITER",
      "restaurant_id": "uuid"
    }
  },
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### Create Order Request/Response
```typescript
// Request
POST /api/v1/orders
Authorization: Bearer {token}
{
  "table_id": "tbl-001",
  "items": [
    {
      "menu_item_id": "item-001",
      "quantity": 2,
      "modifiers": [
        { "modifier_option_id": "mod-opt-002" }
      ]
    }
  ],
  "special_instructions": "No onions"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "ord-uuid",
    "order_number": "ORD-001",
    "status": "CREATED",
    "total_amount": 450.00,
    "items": [
      {
        "id": "oi-001",
        "menu_item_name": "Latte",
        "quantity": 2,
        "status": "PENDING"
      }
    ]
  }
}
```

---

## Environment Configuration

```env
# .env.development
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_WS_URL=ws://localhost:3000
REACT_APP_ENV=development

# .env.production
REACT_APP_API_URL=https://api.auraos.com/api/v1
REACT_APP_WS_URL=wss://api.auraos.com
REACT_APP_ENV=production
```

---

## Testing Requirements

### Unit Tests
- Redux slices
- Utility functions
- Services (authService, orderService, etc.)

### Integration Tests
- API calls with mock data
- Redux store state management
- Navigation flows

### E2E Tests
- Full login flow
- Create order flow
- Payment flow
- Real-time updates

```bash
npm test                    # Run all tests
npm run test:coverage       # Coverage report
npm run e2e                 # E2E tests
```

---

## Performance Optimization

1. **Memoization**: Use `React.memo` for expensive components
2. **FlatList**: Use FlatList for long lists (not ScrollView)
3. **Image Optimization**: Compress and cache images
4. **Code Splitting**: Lazy load screens
5. **State Optimization**: Don't store unnecessary data in Redux
6. **Network**: Implement request debouncing
7. **Caching**: Cache menu for 1 hour, table status refreshed on open

---

## Security Best Practices

1. ✅ Store tokens in secure storage (not AsyncStorage directly on Android)
2. ✅ Use HTTPS only in production
3. ✅ Validate JWT expiry and refresh
4. ✅ Sanitize user inputs
5. ✅ Don't log sensitive data
6. ✅ Use environment variables for secrets
7. ✅ Implement SSL pinning in production

---

## Deployment Checklist

### Before Building
- [ ] All screens implemented
- [ ] All API calls working
- [ ] Real-time events working
- [ ] Offline mode tested
- [ ] Error handling implemented
- [ ] Tests passing
- [ ] Performance optimized

### iOS Build
```bash
eas build --platform ios
# Submit to Apple App Store
```

### Android Build
```bash
eas build --platform android
# Submit to Google Play Store
```

### Post-Deployment
- [ ] Monitor crash reports
- [ ] Monitor API errors
- [ ] User feedback collection
- [ ] Performance metrics

---

## Documentation to Reference

Complete API documentation and specifications are available in `/waiter-app-specs/`:

1. **architecture.md** - System design and architecture
2. **api-spec.yaml** - OpenAPI 3.0 specification (all 26 endpoints)
3. **database.md** - Database schema and relationships
4. **permissions.md** - WAITER role capabilities
5. **screen-flow.md** - All 13 screen specifications
6. **sequence-diagrams.md** - User flow diagrams
7. **state-machines.md** - Order lifecycle state machine
8. **socket-events.md** - WebSocket event documentation
9. **offline-strategy.md** - Offline support strategy
10. **postman_collection.json** - Postman collection for testing
11. **json-examples/** - Request/response examples

---

## Getting Started

```bash
# 1. Install Expo CLI
npm install -g expo-cli

# 2. Create new project
expo init WaiterApp --template

# 3. Install dependencies
cd WaiterApp
npm install

# 4. Add required packages
npm install @reduxjs/toolkit react-redux
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install socket.io-client axios
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo

# 5. Start development
npm start

# 6. Run on iOS/Android
# Scan QR code from terminal to run on Expo Go app
```

---

## Success Criteria

✅ Application is considered complete when:
- [x] All 13 screens implemented and functional
- [x] All 26 API endpoints working
- [x] Real-time WebSocket events working
- [x] Offline mode working (menu cached, cart persisted)
- [x] Authentication with token refresh working
- [x] Order creation, tracking, and payment working
- [x] Push notifications for ORDER_READY events
- [x] Error handling for all error scenarios
- [x] Loading states on all async operations
- [x] All tests passing (>80% coverage)
- [x] Performance optimized (<3s cold start)
- [x] Builds for iOS and Android

---

## Support & Resources

- **API Specs**: `/waiter-app-specs/api-spec.yaml`
- **Examples**: `/waiter-app-specs/json-examples/`
- **Testing**: `/waiter-app-specs/postman_collection.json`
- **Backend**: `http://localhost:3000` (development)

---

**Version**: 1.0
**Last Updated**: June 18, 2026
**Status**: Ready for Development
