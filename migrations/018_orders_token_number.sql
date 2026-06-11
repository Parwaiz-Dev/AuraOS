-- 018_orders_token_number.sql
-- Adds token_number to orders for QSR mode.
-- Token format: {prefix}-{counter} e.g. "T-047"
-- Generated atomically by nextTokenNumber() in restaurants.repository.ts

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS token_number VARCHAR(20) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_token_number ON orders(restaurant_id, token_number)
  WHERE token_number IS NOT NULL;
