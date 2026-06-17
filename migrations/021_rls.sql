-- 021_rls.sql
-- Row-Level Security (RLS) for tenant isolation on the public-facing surface.
--
-- Model:
--   * The app's default DB role (table owner) BYPASSES RLS — used for migrations,
--     super-admin cross-tenant endpoints, and webhooks. Unchanged behaviour.
--   * A dedicated NOLOGIN role `app_tenant` is subject to RLS. The withTenant()
--     helper does `SET LOCAL ROLE app_tenant` + sets app.restaurant_id, so every
--     customer/website query is physically incapable of reading another tenant.
--
-- Policies key on current_setting('app.restaurant_id', true)::uuid. The second
-- arg (missing_ok=true) makes a missing setting return NULL → zero rows, instead
-- of raising — fail-closed, never fail-open.
--
-- Idempotent: safe to re-run. Adding a new tenant table later? Append its name to
-- the array in the DO block below and re-run migrations.

-- ── Dedicated tenant role (NOLOGIN, no BYPASSRLS) ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
END
$$;

-- The application login role (whoever runs migrations / the API) must be a member
-- of app_tenant to be allowed `SET ROLE app_tenant`. Granted to CURRENT_USER so
-- this works regardless of the deployment's DB username.
DO $$
BEGIN
  EXECUTE format('GRANT app_tenant TO %I', current_user);
END
$$;

-- Let the tenant role use the schema and act on tenant tables. Actual row access
-- is still gated by the RLS policies below.
GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;

-- ── Enable RLS + attach a tenant policy to every restaurant-scoped table ───────
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'users',
    'restaurant_tables',
    'menu_categories',
    'menu_items',
    'orders',
    'order_items',
    'inventory_items',
    'payments',
    'integration_logs',
    'restaurant_sections',
    'subscriptions',
    'invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Only touch tables that exist AND carry a restaurant_id column.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'restaurant_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I '
        || 'USING (restaurant_id = current_setting(''app.restaurant_id'', true)::uuid) '
        || 'WITH CHECK (restaurant_id = current_setting(''app.restaurant_id'', true)::uuid)',
        t
      );
    END IF;
  END LOOP;
END
$$;
