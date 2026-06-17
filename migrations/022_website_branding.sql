-- 022_website_branding.sql
-- Public website / "Website Builder" foundation.
--
-- Adds branding fields to restaurants and creates the content tables that power
-- each tenant's website: themes, gallery, editable page sections, opening hours,
-- and custom domains. Every tenant table carries restaurant_id and is protected
-- by the same fail-closed RLS policy established in 021_rls.sql.
--
-- Image policy: we store URLs only (Cloudflare R2 / CDN). NEVER store image bytes
-- in PostgreSQL. All *_url columns hold absolute https URLs to R2 objects.
--
-- Idempotent: uses IF NOT EXISTS / additive ALTERs throughout.

-- ── Branding fields on restaurants ─────────────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS tagline         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS phone           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS public_email    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS social_links    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS latitude        NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude       NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS map_embed_url   TEXT,
  ADD COLUMN IF NOT EXISTS website_published BOOLEAN NOT NULL DEFAULT FALSE;

-- ── restaurant_themes (1:1 with restaurant) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_themes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id    UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
    primary_color    VARCHAR(9)  NOT NULL DEFAULT '#111827',
    secondary_color  VARCHAR(9)  NOT NULL DEFAULT '#f59e0b',
    accent_color     VARCHAR(9)  NOT NULL DEFAULT '#10b981',
    background_color VARCHAR(9)  NOT NULL DEFAULT '#ffffff',
    text_color       VARCHAR(9)  NOT NULL DEFAULT '#111827',
    font_family      VARCHAR(100) NOT NULL DEFAULT 'Inter',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_restaurant_themes_restaurant ON restaurant_themes(restaurant_id);

-- ── gallery_images ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gallery_images (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    url           TEXT NOT NULL,                 -- R2/CDN URL, not bytes
    caption       VARCHAR(255),
    category      VARCHAR(20) NOT NULL DEFAULT 'food'
        CHECK (category IN ('food', 'interior', 'event')),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gallery_images_restaurant ON gallery_images(restaurant_id);

-- ── website_pages (editable section blocks per page) ───────────────────────────
-- page_key: 'home' | 'about' | 'contact' | ...  content: JSONB section blocks
-- so the Website Builder can add/edit sections without schema changes.
CREATE TABLE IF NOT EXISTS website_pages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    page_key      VARCHAR(50) NOT NULL,
    content       JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_published  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (restaurant_id, page_key)
);
CREATE INDEX IF NOT EXISTS idx_website_pages_restaurant ON website_pages(restaurant_id);

-- ── opening_hours (one row per day, 0=Sunday .. 6=Saturday) ────────────────────
CREATE TABLE IF NOT EXISTS opening_hours (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time     TIME,
    close_time    TIME,
    is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (restaurant_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_opening_hours_restaurant ON opening_hours(restaurant_id);

-- ── custom_domains (apex/custom hostnames -> tenant) ───────────────────────────
-- ssl_status drives the Caddy on-demand TLS workflow in a later phase.
CREATE TABLE IF NOT EXISTS custom_domains (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    domain        VARCHAR(255) NOT NULL UNIQUE,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
    ssl_status    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (ssl_status IN ('PENDING', 'ACTIVE', 'FAILED')),
    verification_token VARCHAR(100),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_custom_domains_restaurant ON custom_domains(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain     ON custom_domains(domain);

-- ── Extend RLS to the new tenant tables ────────────────────────────────────────
-- Same fail-closed policy as 021. custom_domains is read by the host->tenant
-- middleware BEFORE a tenant is known, so that lookup uses the privileged
-- (RLS-bypassing) login role; the policy here still protects tenant-scoped access.
DO $$
DECLARE
  t TEXT;
  new_tables TEXT[] := ARRAY[
    'restaurant_themes',
    'gallery_images',
    'website_pages',
    'opening_hours',
    'custom_domains'
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
