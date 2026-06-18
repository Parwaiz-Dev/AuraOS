-- 026_loyalty_coupons_reviews.sql
-- Phase 4: coupons, loyalty, reviews, favorites.
--
-- All tenant-scoped (restaurant_id) under the standard fail-closed RLS policy.
-- Loyalty uses an account (current balance) + an immutable ledger (earn/redeem
-- history) so the balance is always auditable and reconstructable.

-- ── coupons ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code            VARCHAR(40) NOT NULL,
    description     VARCHAR(255),
    discount_type   VARCHAR(10) NOT NULL DEFAULT 'FLAT'
        CHECK (discount_type IN ('FLAT', 'PERCENT')),
    discount_value  NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_order       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_discount    NUMERIC(10, 2),                 -- cap for PERCENT coupons
    usage_limit     INTEGER,                        -- total redemptions allowed (NULL = unlimited)
    used_count      INTEGER NOT NULL DEFAULT 0,
    valid_from      TIMESTAMP,
    valid_until     TIMESTAMP,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (restaurant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_coupons_restaurant ON coupons(restaurant_id);

-- ── loyalty_accounts (current balance per customer per restaurant) ─────────────
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points_balance  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (restaurant_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_restaurant ON loyalty_accounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer ON loyalty_accounts(customer_id);

-- ── loyalty_ledger (immutable earn/redeem history) ─────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
    points          INTEGER NOT NULL,               -- +earn / -redeem
    reason          VARCHAR(20) NOT NULL CHECK (reason IN ('EARN', 'REDEEM', 'ADJUST')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_restaurant ON loyalty_ledger(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_customer ON loyalty_ledger(customer_id);

-- ── reviews ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           VARCHAR(120),
    body            TEXT,
    photo_urls      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- R2/CDN URLs only
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,        -- owner can hide
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(restaurant_id, is_published);

-- ── favorites (customer's favorite menu items per restaurant) ──────────────────
CREATE TABLE IF NOT EXISTS favorites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (customer_id, menu_item_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_restaurant ON favorites(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_favorites_customer ON favorites(customer_id);

-- ── loyalty config on restaurants (earn/redeem rates) ──────────────────────────
-- points_per_currency: points earned per ₹1 spent (default 0.1 => ₹1000 = 100 pts)
-- redeem_value: ₹ value of 1 point when redeemed (default 1 => 100 pts = ₹100)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS loyalty_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_currency NUMERIC(6, 3) NOT NULL DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS loyalty_redeem_value   NUMERIC(6, 3) NOT NULL DEFAULT 1.0;

-- ── RLS ────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  new_tables TEXT[] := ARRAY[
    'coupons', 'loyalty_accounts', 'loyalty_ledger', 'reviews', 'favorites'
  ];
BEGIN
  FOREACH t IN ARRAY new_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_tenant', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      || 'USING (restaurant_id = current_setting(''app.restaurant_id'', true)::uuid) '
      || 'WITH CHECK (restaurant_id = current_setting(''app.restaurant_id'', true)::uuid)',
      t
    );
  END LOOP;
END
$$;
