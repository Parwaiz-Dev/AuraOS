-- 013_missing_indexes.sql
-- Adds indexes identified in the production-readiness audit.
--
-- 1. payments(reference_number)
--    The Razorpay webhook looks up the pending payment by reference_number on
--    every payment.captured event.  Without an index this is a full table scan
--    that grows linearly with payment volume and can exceed Razorpay's 5-second
--    response window, causing the webhook to be retried indefinitely.
--
-- 2. integration_logs(restaurant_id, source, external_id)
--    The Zomato and WhatsApp deduplication check queries this triple on every
--    incoming webhook.  Without a composite index the query hits all rows for
--    the restaurant, which degrades under high integration volume.
--
-- 3. payments(order_id, status)
--    The atomic payment creation reads SUM(amount) WHERE order_id = ? AND
--    status = 'PAID' inside the transaction.  A composite index lets Postgres
--    satisfy this with an index-only scan instead of a filter on the order_id
--    index result set.

CREATE INDEX IF NOT EXISTS idx_payments_reference_number
  ON payments(reference_number)
  WHERE reference_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_logs_dedup
  ON integration_logs(restaurant_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_status
  ON payments(order_id, status);
