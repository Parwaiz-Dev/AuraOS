-- 012_restaurant_features.sql
-- Per-restaurant feature flags.
--
-- Stored as a JSONB column so adding new features never requires a migration.
-- The application reads this at startup and uses it to show/hide features.
--
-- Default (all features ON) means existing restaurants are unaffected.
-- Admin can toggle features from Settings → Features in the staff portal.
--
-- Supported flags (all boolean, default true):
--   kitchen_display   — show the Kitchen Display screen
--   inventory         — show Inventory management
--   reports           — show Reports / analytics
--   qr_ordering       — enable QR / customer ordering
--   whatsapp          — enable WhatsApp integration
--   zomato            — enable Zomato integration
--   payments          — enable payment recording
--   waiter_app        — enable the Waiter PWA

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{
    "kitchen_display": true,
    "inventory": true,
    "reports": true,
    "qr_ordering": true,
    "whatsapp": true,
    "zomato": true,
    "payments": true,
    "waiter_app": true
  }'::jsonb;
