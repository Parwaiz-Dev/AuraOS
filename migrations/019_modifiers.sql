-- 019_modifiers.sql
-- Modifier groups & options for menu item customization.
--
-- Example: A "Latte" menu item can have modifier groups:
--   Size  (single select): Small (+₹0), Medium (+₹20), Large (+₹40)
--   Milk  (single select): Full Cream (+₹0), Oat (+₹30), Almond (+₹30)
--   Extras (multiple select): Whipped Cream (+₹15), Extra Shot (+₹25)
--
-- selection_type: 'single' = radio (pick one), 'multiple' = checkboxes
-- min_select / max_select constrain how many options can be chosen.

-- ── Modifier Groups ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modifier_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    selection_type  VARCHAR(10) NOT NULL DEFAULT 'single'
        CHECK (selection_type IN ('single', 'multiple')),
    min_select      INTEGER NOT NULL DEFAULT 0,
    max_select      INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_modifier_groups_restaurant ON modifier_groups(restaurant_id);

-- ── Modifier Options (choices within a group) ────────────────────────────────
CREATE TABLE IF NOT EXISTS modifier_options (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id   UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    price_adjustment    DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(modifier_group_id, name)
);

CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(modifier_group_id);

-- ── Menu Item ↔ Modifier Group junction ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_item_modifier_groups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id        UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_group_id   UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_item_id, modifier_group_id)
);

CREATE INDEX IF NOT EXISTS idx_mimg_menu_item ON menu_item_modifier_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mimg_modifier_group ON menu_item_modifier_groups(modifier_group_id);

-- ── Order Item Modifiers (stores selections when an item is ordered) ──────────
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id       UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_group_id   UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE RESTRICT,
    modifier_group_name VARCHAR(255) NOT NULL,   -- denormalized for bill printing
    modifier_option_id  UUID NOT NULL REFERENCES modifier_options(id) ON DELETE RESTRICT,
    modifier_option_name VARCHAR(255) NOT NULL,   -- denormalized for bill printing
    price_adjustment    DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_oim_order_item ON order_item_modifiers(order_item_id);