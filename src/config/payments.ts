/**
 * ============================================================
 * PAYMENT GATEWAY CONFIGURATION
 * ============================================================
 *
 * AuraOS supports multiple payment methods for QR ordering.
 * Currently the system records payment intent (method chosen by customer)
 * but does NOT process real payments — that requires integrating a
 * payment gateway below.
 *
 * HOW TO ENABLE A GATEWAY
 * ─────────────────────────
 * 1. Add the gateway's credentials to your .env file
 * 2. Set PAYMENT_GATEWAY=razorpay (or stripe / payu / cashfree)
 * 3. Uncomment and fill in the relevant section below
 * 4. Implement the gateway's webhook handler in:
 *    src/modules/payments/payments.gateway.ts  (create this file)
 * 5. Register the webhook route in src/app.ts:
 *    app.use('/api/v1/webhooks/payments', paymentWebhookRoutes)
 *
 * SUPPORTED PAYMENT METHODS (UI already built)
 * ─────────────────────────────────────────────
 *  - CASH    → Pay at counter (no gateway needed)
 *  - UPI     → Razorpay / Cashfree / PayU
 *  - CARD    → Razorpay / Stripe
 *  - ONLINE  → Net banking / Wallets via Razorpay / Cashfree
 *
 * ============================================================
 */

// ── Active gateway ────────────────────────────────────────────────────────────
// Set this in .env: PAYMENT_GATEWAY=razorpay
// Leave empty or 'none' to disable online payments (cash-only mode)
export const ACTIVE_GATEWAY = process.env.PAYMENT_GATEWAY || 'none';

// ── Gateway: Razorpay ─────────────────────────────────────────────────────────
// Popular in India. Supports UPI, Cards, Net Banking, Wallets.
// Docs: https://razorpay.com/docs/
//
// Setup steps:
//   1. Create account at https://dashboard.razorpay.com
//   2. Get Key ID and Key Secret from Settings → API Keys
//   3. Add to .env:
//        RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
//        RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
//        RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
//   4. npm install razorpay
//   5. Uncomment the implementation below
//
export const razorpay = {
  enabled: ACTIVE_GATEWAY === 'razorpay',
  keyId:     process.env.RAZORPAY_KEY_ID     || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  // Currency for all transactions
  currency: 'INR',
  // Razorpay order creation endpoint
  // POST https://api.razorpay.com/v1/orders
  // Implementation: src/modules/payments/gateways/razorpay.gateway.ts
};

// ── Gateway: Stripe ───────────────────────────────────────────────────────────
// Popular globally. Best for Card payments.
// Docs: https://stripe.com/docs
//
// Setup steps:
//   1. Create account at https://dashboard.stripe.com
//   2. Get Publishable Key and Secret Key from Developers → API Keys
//   3. Add to .env:
//        STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
//        STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
//        STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
//   4. npm install stripe
//   5. Uncomment the implementation below
//
export const stripe = {
  enabled: ACTIVE_GATEWAY === 'stripe',
  secretKey:      process.env.STRIPE_SECRET_KEY      || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET  || '',
  currency: 'inr',
  // Implementation: src/modules/payments/gateways/stripe.gateway.ts
};

// ── Gateway: Cashfree ─────────────────────────────────────────────────────────
// Popular in India. Supports UPI, Cards, Net Banking.
// Docs: https://docs.cashfree.com/
//
// Setup steps:
//   1. Create account at https://merchant.cashfree.com
//   2. Get App ID and Secret Key from Developers → API Keys
//   3. Add to .env:
//        CASHFREE_APP_ID=your_app_id
//        CASHFREE_SECRET_KEY=your_secret_key
//        CASHFREE_ENV=TEST  (or PROD for production)
//   4. npm install cashfree-sdk
//   5. Uncomment the implementation below
//
export const cashfree = {
  enabled: ACTIVE_GATEWAY === 'cashfree',
  appId:     process.env.CASHFREE_APP_ID     || '',
  secretKey: process.env.CASHFREE_SECRET_KEY || '',
  env:       process.env.CASHFREE_ENV        || 'TEST', // 'TEST' | 'PROD'
  // Implementation: src/modules/payments/gateways/cashfree.gateway.ts
};

// ── Gateway: PayU ─────────────────────────────────────────────────────────────
// Popular in India. Supports UPI, Cards, EMI.
// Docs: https://devguide.payu.in/
//
// Setup steps:
//   1. Create account at https://onboarding.payu.in
//   2. Get Merchant Key and Salt from Dashboard → Profile
//   3. Add to .env:
//        PAYU_MERCHANT_KEY=your_merchant_key
//        PAYU_MERCHANT_SALT=your_merchant_salt
//        PAYU_ENV=test  (or production)
//   4. npm install payu-nodejs-sdk (or use axios directly)
//   5. Uncomment the implementation below
//
export const payu = {
  enabled: ACTIVE_GATEWAY === 'payu',
  merchantKey:  process.env.PAYU_MERCHANT_KEY  || '',
  merchantSalt: process.env.PAYU_MERCHANT_SALT || '',
  env:          process.env.PAYU_ENV           || 'test', // 'test' | 'production'
  // Implementation: src/modules/payments/gateways/payu.gateway.ts
};

// ── Helper: get active gateway config ────────────────────────────────────────
export function getActiveGateway() {
  switch (ACTIVE_GATEWAY) {
    case 'razorpay': return razorpay;
    case 'stripe':   return stripe;
    case 'cashfree': return cashfree;
    case 'payu':     return payu;
    default:         return null; // cash-only mode
  }
}

// ── Helper: is online payment enabled? ───────────────────────────────────────
export function isOnlinePaymentEnabled(): boolean {
  return ACTIVE_GATEWAY !== 'none' && ACTIVE_GATEWAY !== '';
}

/**
 * ============================================================
 * WEBHOOK FLOW (implement when you add a gateway)
 * ============================================================
 *
 * When a customer pays online, the flow is:
 *
 *  Customer → QR App → POST /api/v1/public/order/:slug
 *                         ↓ creates order with status=CREATED
 *                         ↓ creates payment with status=PENDING
 *                         ↓ returns { order_number, payment_url }
 *
 *  Customer → redirected to payment_url (Razorpay/Stripe checkout)
 *
 *  Gateway → POST /api/v1/webhooks/payments (on success/failure)
 *              ↓ verify signature
 *              ↓ update payment status → PAID or FAILED
 *              ↓ if PAID: update order status → ACCEPTED
 *              ↓ broadcast Socket.io event → PAYMENT_COMPLETED
 *
 * ============================================================
 *
 * FILES TO CREATE when implementing:
 *
 *  src/modules/payments/
 *  ├── gateways/
 *  │   ├── razorpay.gateway.ts   ← create order, verify webhook
 *  │   ├── stripe.gateway.ts     ← create payment intent, verify webhook
 *  │   ├── cashfree.gateway.ts   ← create order, verify webhook
 *  │   └── payu.gateway.ts       ← create transaction, verify hash
 *  └── payments.webhook.ts       ← unified webhook handler
 *
 *  src/modules/public/public.routes.ts
 *  └── Add payment_url to the order response when gateway is active
 *
 * ============================================================
 */
