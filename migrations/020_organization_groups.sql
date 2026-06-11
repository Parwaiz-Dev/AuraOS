-- 020_organization_groups.sql
-- Multi-Outlet: Organization groups allow one owner account to manage multiple restaurants.
--
-- organization_groups — named groups owned by a platform user (super admin).
-- organization_group_restaurants — many-to-many linking restaurants into groups.
--
-- Tenant isolation: Each restaurant's data remains in its own restaurant-scoped tables.
-- These tables ONLY track group membership for aggregation & switching purposes.

-- ── Organization Groups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_groups_owner ON organization_groups(owner_user_id);

-- ── Organization Group ↔ Restaurant (many-to-many) ────────────────────────────
CREATE TABLE IF NOT EXISTS organization_group_restaurants (
    organization_group_id   UUID NOT NULL REFERENCES organization_groups(id) ON DELETE CASCADE,
    restaurant_id           UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    added_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_group_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_org_group_rest_group ON organization_group_restaurants(organization_group_id);
CREATE INDEX IF NOT EXISTS idx_org_group_rest_restaurant ON organization_group_restaurants(restaurant_id);