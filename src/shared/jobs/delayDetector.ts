/**
 * Delay Detector — background job.
 *
 * Runs every 30 seconds. Finds all active orders (CREATED, ACCEPTED, PREPARING)
 * that have been open longer than the restaurant's configured
 * `delay_threshold_minutes` and broadcasts an ORDER_DELAYED Socket.io event
 * to the restaurant room.
 *
 * The frontend Kitchen Display and Orders page listen for ORDER_DELAYED and
 * highlight the affected order card in red so kitchen staff can act.
 *
 * Why 30 seconds?
 *   - Short enough that staff notice delays quickly
 *   - Long enough not to spam the DB or Socket.io
 *   - Each run is a single SQL query (no N+1)
 *
 * The job does NOT change order status — it only alerts. Staff decide what to do.
 *
 * Configuration:
 *   delay_threshold_minutes is set per restaurant in the restaurants table.
 *   Default is 15 minutes (set in migration 002_core.sql).
 *   Admin can change it via PUT /api/v1/restaurants/me.
 */

import { query } from '@/config/database';
import { eventBroadcaster, DelayedOrderPayload } from '@/shared/socket/eventBroadcaster';

// Track which orders we've already alerted to avoid spamming every 30s.
// Key: order_id, Value: timestamp of last alert sent.
// Cleared when the order is completed/cancelled (via ORDER_COMPLETED event).
const alertedOrders = new Map<string, number>();

// Re-alert if the order is still delayed after this many minutes
const RE_ALERT_INTERVAL_MINUTES = 10;

// Only alert on orders created within the last 24 hours.
// Orders older than this are almost certainly test/dev data — not real delays.
// In production, increase this if you have very long-running orders.
const MAX_ORDER_AGE_HOURS = 24;

// Evict alert-cache entries older than this to bound memory usage.
// Entries beyond MAX_ORDER_AGE_HOURS are for orders the DB query already
// excludes, so they will never be re-alerted and can be safely removed.
const MAX_CACHE_AGE_MS = MAX_ORDER_AGE_HOURS * 60 * 60 * 1000;

function evictStaleCacheEntries(): void {
  const cutoff = Date.now() - MAX_CACHE_AGE_MS;
  for (const [id, lastAlerted] of alertedOrders.entries()) {
    if (lastAlerted < cutoff) {
      alertedOrders.delete(id);
    }
  }
}

export async function runDelayDetector(): Promise<void> {
  try {
    // Evict cache entries older than MAX_ORDER_AGE_HOURS on every tick to
    // prevent unbounded Map growth from uncompleted/manually-deleted orders.
    evictStaleCacheEntries();

    // Single query: find all delayed orders across all restaurants.
    // Joins restaurants to get the threshold per restaurant.
    // Only looks at orders created within MAX_ORDER_AGE_HOURS to skip old test data.
    const result = await query(
      `SELECT
         o.id AS order_id,
         o.restaurant_id,
         o.order_number,
         o.status,
         o.created_at,
         rt.table_number,
         r.delay_threshold_minutes,
         EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       WHERE o.status NOT IN ('COMPLETED', 'CANCELLED')
         AND NOW() > o.created_at + (r.delay_threshold_minutes || ' minutes')::interval
         AND o.created_at > NOW() - ($1 || ' hours')::interval
       ORDER BY minutes_elapsed DESC`,
      [MAX_ORDER_AGE_HOURS],
    );

    if (result.rows.length === 0) return;

    const now = Date.now();

    for (const row of result.rows) {
      const lastAlerted = alertedOrders.get(row.order_id);
      const minutesSinceLastAlert = lastAlerted
        ? (now - lastAlerted) / 60000
        : Infinity;

      // Skip if we alerted recently (within RE_ALERT_INTERVAL_MINUTES)
      if (minutesSinceLastAlert < RE_ALERT_INTERVAL_MINUTES) continue;

      const payload: DelayedOrderPayload = {
        order_id:          row.order_id,
        restaurant_id:     row.restaurant_id,
        order_number:      row.order_number,
        status:            row.status,
        minutes_elapsed:   Math.floor(parseFloat(row.minutes_elapsed)),
        threshold_minutes: parseInt(row.delay_threshold_minutes, 10),
        table_number:      row.table_number || null,
      };

      eventBroadcaster?.broadcastOrderDelayed(payload);
      alertedOrders.set(row.order_id, now);

      console.log(
        `[DelayDetector] ⚠️  Order ${row.order_number} delayed ` +
        `(${payload.minutes_elapsed}m / threshold ${payload.threshold_minutes}m) ` +
        `— restaurant ${row.restaurant_id}`,
      );
    }
  } catch (err) {
    // Never crash the job runner — log and continue
    console.error('[DelayDetector] Error:', err);
  }
}

/**
 * Clear a specific order from the alert cache when it's completed or cancelled.
 * Call this from the orders controller after a status update.
 */
export function clearDelayAlert(orderId: string): void {
  alertedOrders.delete(orderId);
}
