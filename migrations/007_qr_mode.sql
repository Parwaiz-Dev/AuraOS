-- 007_qr_mode.sql
-- Add QR ordering mode to restaurants
-- 'restaurant' = dine-in with table selection (default)
-- 'mall'       = food court / takeaway with customer details + payment choice

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS qr_mode VARCHAR(20) NOT NULL DEFAULT 'restaurant'
    CHECK (qr_mode IN ('restaurant', 'mall'));
