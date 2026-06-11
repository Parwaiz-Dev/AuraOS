-- 009_inventory_history.sql
-- Logs every stock change with who changed it, when, by how much, and why.

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,

    -- Stock levels
    quantity_before INTEGER NOT NULL,
    quantity_after  INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,  -- positive = added, negative = removed

    -- Transaction type
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('RESTOCK', 'ADJUSTMENT', 'USAGE', 'INITIAL')),

    -- Optional context
    notes           TEXT,
    changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inv_tx_restaurant   ON inventory_transactions(restaurant_id);
CREATE INDEX idx_inv_tx_item         ON inventory_transactions(inventory_item_id);
CREATE INDEX idx_inv_tx_created      ON inventory_transactions(created_at DESC);
CREATE INDEX idx_inv_tx_type         ON inventory_transactions(transaction_type);
