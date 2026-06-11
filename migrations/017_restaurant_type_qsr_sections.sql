-- 017_restaurant_type_qsr_sections.sql
--
-- Adds:
--   1. restaurant_type  — what kind of operation this restaurant runs
--   2. QSR fields       — token prefix, daily reset, counter
--   3. restaurant_sections — physical counters/stations (Food, Beverages, etc.)
--   4. section_id on menu_categories — which counter handles which category
--
-- Restaurant types:
--   FULL_SERVICE   — sit-down, table service, waiter takes order (default)
--   QSR_SIMPLE     — small quick-service: counter token, no table (chai shop, fast food stall)
--   QSR_CHAIN      — branded QSR: McDonald's / KFC style, token board, multi-section printing
--   CAFE           — counter + some seating, modifiers, loyalty focus
--   CLOUD_KITCHEN  — delivery only, no dine-in
--   HYBRID         — dine-in + takeaway + delivery simultaneously

-- ── 1. Restaurant type ────────────────────────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS restaurant_type VARCHAR(20) NOT NULL DEFAULT 'FULL_SERVICE'
    CHECK (restaurant_type IN ('FULL_SERVICE','QSR_SIMPLE','QSR_CHAIN','CAFE','CLOUD_KITCHEN','HYBRID'));

-- ── 2. QSR fields ─────────────────────────────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS qsr_enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS token_prefix        VARCHAR(10) NOT NULL DEFAULT 'T',
  ADD COLUMN IF NOT EXISTS token_daily_reset   BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS token_counter       INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_last_reset_at DATE        DEFAULT NULL;

-- ── 3. Restaurant sections (counters/stations) ────────────────────────────────
-- A section is a physical counter — e.g. "Food", "Beverages", "Desserts".
-- Each order's items are grouped by section for token slip printing.
CREATE TABLE IF NOT EXISTS restaurant_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sections_restaurant ON restaurant_sections(restaurant_id);

-- ── 4. Assign categories to sections ─────────────────────────────────────────
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES restaurant_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_categories_section ON menu_categories(section_id);
