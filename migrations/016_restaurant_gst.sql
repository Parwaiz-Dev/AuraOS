-- 016_restaurant_gst.sql
-- Adds GST configuration to the restaurants table.
--
-- gstin          : GST Identification Number (15 chars), printed on bills
-- tax_rate       : percentage applied to all orders (default 5.0 for non-AC restaurants)
-- tax_inclusive  : if TRUE, item prices already include GST (split on bill)
--                  if FALSE, GST is added on top of the subtotal
--
-- Standard India slabs:
--   5%  — non-AC restaurants (no input credit)
--   18% — AC restaurants / with liquor license
--   0%  — exempt (e.g. small roadside stalls)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS gstin          VARCHAR(15)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate       NUMERIC(5,2)  NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS tax_inclusive  BOOLEAN       NOT NULL DEFAULT FALSE;
