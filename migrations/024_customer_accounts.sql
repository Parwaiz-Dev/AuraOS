-- 024_customer_accounts.sql
-- Phase 2: customer accounts (phone-OTP), delivery addresses, and the
-- OUT_FOR_DELIVERY order status. Enables online ordering with a customer
-- identity for order history, addresses, and (later) loyalty/favorites/reviews.
--
-- Customers are GLOBAL (a person can order from many restaurants), so the
-- `customers` table is NOT tenant-scoped. Their per-restaurant footprint
-- (orders, addresses) carries restaurant_id and stays under RLS.

-- ── Extend order_status with OUT_FOR_DELIVERY ──────────────────────────────────
-- Full website delivery lifecycle:
--   CREATED -> ACCEPTED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> COMPLETED
-- (COMPLETED is the existing terminal "delivered/done" state; CANCELLED aborts.)
-- ADD VALUE IF NOT EXISTS is idempotent and must run outside a transaction —
-- the migrate runner executes statements individually, so this is safe.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY' AFTER 'READY';

-- ── customers (global, not tenant-scoped) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        VARCHAR(20) NOT NULL UNIQUE,   -- E.164, the login identity
    name         VARCHAR(120),
    email        VARCHAR(255),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ── customer_otps (login one-time codes) ───────────────────────────────────────
-- Used as the durable fallback when Redis is unavailable. Stores a HASH of the
-- code (never the plaintext). Short-lived rows; expired ones are ignored/cleaned.
CREATE TABLE IF NOT EXISTS customer_otps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        VARCHAR(20) NOT NULL,
    code_hash    VARCHAR(120) NOT NULL,
    attempts     SMALLINT NOT NULL DEFAULT 0,
    expires_at   TIMESTAMP NOT NULL,
    consumed_at  TIMESTAMP,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_otps_phone ON customer_otps(phone);
CREATE INDEX IF NOT EXISTS idx_customer_otps_expires ON customer_otps(expires_at);

-- ── customer_addresses (tenant-scoped delivery addresses) ──────────────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    label         VARCHAR(40),                  -- Home / Work / ...
    line1         VARCHAR(255) NOT NULL,
    line2         VARCHAR(255),
    city          VARCHAR(120),
    pincode       VARCHAR(12),
    latitude      NUMERIC(10, 7),
    longitude     NUMERIC(10, 7),
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_restaurant ON customer_addresses(restaurant_id);

-- ── Link orders to a customer (nullable — guest orders still allowed) ───────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivery_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- ── RLS for the new tenant-scoped table ────────────────────────────────────────
-- customer_addresses is tenant-scoped. customers/customer_otps are global and
-- are accessed only through the privileged role (auth flow), so no RLS on them.
DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON customer_addresses TO app_tenant;
  ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON customer_addresses;
  CREATE POLICY tenant_isolation ON customer_addresses
    USING (restaurant_id = current_setting('app.restaurant_id', true)::uuid)
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true)::uuid);
END
$$;
