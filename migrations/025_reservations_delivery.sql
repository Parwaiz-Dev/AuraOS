-- 025_reservations_delivery.sql
-- Phase 3: table booking (reservations) and named delivery zones.
--
-- reservations  — customer table-booking requests; owner manages status in the
--                 dashboard. Lifecycle: PENDING -> CONFIRMED -> COMPLETED, or CANCELLED.
-- delivery_zones — named locality/pincode -> fee mapping (more practical than
--                 pure radius). Quote endpoint matches a customer pincode to a zone.
--
-- Both tenant-scoped (restaurant_id) and protected by the standard fail-closed
-- RLS policy from 021.

-- ── reservations ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name   VARCHAR(120) NOT NULL,
    customer_phone  VARCHAR(20)  NOT NULL,
    party_size      SMALLINT     NOT NULL CHECK (party_size > 0 AND party_size <= 100),
    reserved_for    TIMESTAMP    NOT NULL,        -- requested date + time
    special_requests TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant ON reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status     ON reservations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_for        ON reservations(restaurant_id, reserved_for);

-- ── delivery_zones ─────────────────────────────────────────────────────────────
-- A zone matches by pincode (exact) and/or a free-text area label. fee is the
-- delivery charge; min_order is an optional threshold; eta_minutes is shown to
-- the customer. is_active toggles availability without deletion.
CREATE TABLE IF NOT EXISTS delivery_zones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,          -- e.g. "Koramangala"
    pincode       VARCHAR(12),                    -- exact-match key (nullable)
    fee           NUMERIC(10, 2) NOT NULL DEFAULT 0,
    min_order     NUMERIC(10, 2) NOT NULL DEFAULT 0,
    eta_minutes   INTEGER,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_pincode    ON delivery_zones(restaurant_id, pincode);

-- ── RLS ────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  new_tables TEXT[] := ARRAY['reservations', 'delivery_zones'];
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
