-- 010_zomato_mapping.sql
-- Maps Zomato item IDs to your internal menu item UUIDs.
--
-- When Zomato sends a webhook order, each item has a Zomato-specific item_id.
-- This table lets you tell the system: "Zomato item 12345 = Biryani in our menu".
--
-- One mapping per Zomato item ID per restaurant.
-- If no mapping exists for an item, the order is still created but that item
-- is logged as unmapped (so you can add the mapping later).

CREATE TABLE IF NOT EXISTS zomato_item_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    zomato_item_id  VARCHAR(100) NOT NULL,   -- Zomato's item ID (string)
    zomato_item_name VARCHAR(255),           -- Zomato's item name (for display)
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, zomato_item_id)    -- one mapping per Zomato item per restaurant
);

CREATE INDEX idx_zomato_mappings_restaurant ON zomato_item_mappings(restaurant_id);
CREATE INDEX idx_zomato_mappings_zomato_id  ON zomato_item_mappings(zomato_item_id);
