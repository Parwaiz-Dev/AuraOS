-- 028_schema_hardening.sql
-- Production hardening: TIMESTAMPTZ, CHECK constraints, financial FK safety.

-- ── Convert TIMESTAMP → TIMESTAMPTZ for point-in-time columns ────────────────
-- These are the most critical: token/OTP expiry, reservation times, audit trails.
-- ALTER COLUMN ... TYPE TIMESTAMPTZ rewrites in-place, interpreting existing
-- values as the server's timezone (typically UTC in Docker).

ALTER TABLE password_reset_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ;
ALTER TABLE password_reset_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE refresh_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ;
ALTER TABLE refresh_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE customer_otps ALTER COLUMN expires_at TYPE TIMESTAMPTZ;
ALTER TABLE customer_otps ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE reservations ALTER COLUMN reserved_for TYPE TIMESTAMPTZ;
ALTER TABLE reservations ALTER COLUMN created_at TYPE TIMESTAMPTZ;
ALTER TABLE reservations ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE orders ALTER COLUMN created_at TYPE TIMESTAMPTZ;
ALTER TABLE orders ALTER COLUMN updated_at TYPE TIMESTAMPTZ;
ALTER TABLE orders ALTER COLUMN completed_at TYPE TIMESTAMPTZ;

ALTER TABLE payments ALTER COLUMN created_at TYPE TIMESTAMPTZ;
ALTER TABLE payments ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

-- ── CHECK constraints: positivity on quantity/price/amount ───────────────────
DO $$ BEGIN
  ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE menu_items ADD CONSTRAINT chk_menu_items_price CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT chk_payments_amount CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE modifier_groups ADD CONSTRAINT chk_modifier_min_max
    CHECK (min_select <= max_select);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Financial tables: ON DELETE RESTRICT ─────────────────────────────────────
-- Prevent accidental mass-deletion of payment/invoice history when a restaurant
-- is deleted. Offboarding should be a deliberate, guarded operation.

-- payments.restaurant_id: CASCADE → RESTRICT
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_restaurant_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT;

-- subscription_invoices.restaurant_id: CASCADE → RESTRICT
ALTER TABLE subscription_invoices DROP CONSTRAINT IF EXISTS subscription_invoices_restaurant_id_fkey;
ALTER TABLE subscription_invoices ADD CONSTRAINT subscription_invoices_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT;
