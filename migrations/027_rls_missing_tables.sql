-- 027_rls_missing_tables.sql
-- Add Row-Level Security policies to tenant tables that were missed in 021_rls.sql.
-- Tables: inventory_transactions, zomato_item_mappings, support_tickets, modifier_groups.
-- All carry restaurant_id but had no RLS policy despite app_tenant being granted DML.

-- ── inventory_transactions ──────────────────────────────────────────────────
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation_inventory_transactions ON inventory_transactions
    USING (restaurant_id::text = current_setting('app.restaurant_id', true))
    WITH CHECK (restaurant_id::text = current_setting('app.restaurant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── zomato_item_mappings ────────────────────────────────────────────────────
ALTER TABLE zomato_item_mappings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation_zomato_item_mappings ON zomato_item_mappings
    USING (restaurant_id::text = current_setting('app.restaurant_id', true))
    WITH CHECK (restaurant_id::text = current_setting('app.restaurant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── support_tickets ─────────────────────────────────────────────────────────
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation_support_tickets ON support_tickets
    USING (restaurant_id::text = current_setting('app.restaurant_id', true))
    WITH CHECK (restaurant_id::text = current_setting('app.restaurant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── modifier_groups ─────────────────────────────────────────────────────────
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation_modifier_groups ON modifier_groups
    USING (restaurant_id::text = current_setting('app.restaurant_id', true))
    WITH CHECK (restaurant_id::text = current_setting('app.restaurant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
