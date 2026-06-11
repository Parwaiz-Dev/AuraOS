/**
 * Inventory Sync — background job.
 *
 * Runs every 60 seconds. Scans all inventory items across all restaurants
 * and broadcasts INVENTORY_LOW_STOCK for any item at or below its reorder level.
 *
 * Why do this as a background job in addition to the controller?
 *   - The inventory controller already broadcasts when staff manually adjust stock.
 *   - But stock can also drop implicitly (e.g. when orders are completed and
 *     inventory is decremented — not yet implemented, but planned).
 *   - This job acts as a safety net: even if a broadcast was missed, the
 *     Dashboard and Reports page will get a fresh alert within 60 seconds.
 *
 * The job does NOT modify any data — read-only.
 *
 * Deduplication:
 *   We track which items have already been alerted. An item is re-alerted
 *   only if its stock level changes (drops further) or after 30 minutes.
 *   This prevents the Dashboard from being flooded with repeated alerts.
 */

import { query } from '@/config/database';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

interface AlertState {
  lastStock: number;
  lastAlertedAt: number;
}

// Key: inventory_item_id → last known stock + alert timestamp
const alertState = new Map<string, AlertState>();

// Re-alert after this many minutes even if stock hasn't changed
const RE_ALERT_INTERVAL_MINUTES = 30;

export async function runInventorySync(): Promise<void> {
  try {
    // Single query across all restaurants — no N+1
    const result = await query(
      `SELECT
         i.id AS inventory_item_id,
         i.restaurant_id,
         i.menu_item_id,
         i.current_stock,
         i.reorder_level,
         mi.name AS menu_item_name
       FROM inventory_items i
       JOIN menu_items mi ON mi.id = i.menu_item_id
       WHERE i.current_stock <= i.reorder_level
         AND mi.is_active = TRUE
       ORDER BY i.current_stock ASC
       LIMIT 500`,
    );

    const now = Date.now();
    const currentLowIds = new Set<string>();

    for (const row of result.rows) {
      currentLowIds.add(row.inventory_item_id);

      const state = alertState.get(row.inventory_item_id);
      const stockChanged = !state || state.lastStock !== row.current_stock;
      const minutesSinceAlert = state
        ? (now - state.lastAlertedAt) / 60000
        : Infinity;

      // Alert if: first time, stock dropped further, or re-alert interval passed
      if (stockChanged || minutesSinceAlert >= RE_ALERT_INTERVAL_MINUTES) {
        eventBroadcaster?.broadcastInventoryLowStock({
          inventory_item_id: row.inventory_item_id,
          restaurant_id:     row.restaurant_id,
          menu_item_id:      row.menu_item_id,
          current_stock:     parseInt(row.current_stock, 10),
          reorder_level:     parseInt(row.reorder_level, 10),
        });

        alertState.set(row.inventory_item_id, {
          lastStock:     parseInt(row.current_stock, 10),
          lastAlertedAt: now,
        });

        if (stockChanged) {
          console.log(
            `[InventorySync] ⚠️  Low stock: ${row.menu_item_name} ` +
            `(${row.current_stock} / reorder at ${row.reorder_level}) ` +
            `— restaurant ${row.restaurant_id}`,
          );
        }
      }
    }

    // Remove entries for items that are no longer low-stock (stock replenished).
    // This handles both the partial-recovery case (some items recovered) and the
    // full-recovery case (result.rows is empty, currentLowIds is empty set) —
    // every stale entry is removed selectively without a full Map.clear(), which
    // would cause all previously-alerted items to re-broadcast as new on the very
    // next low-stock event, flooding all kitchen displays simultaneously.
    for (const id of alertState.keys()) {
      if (!currentLowIds.has(id)) {
        alertState.delete(id);
      }
    }
  } catch (err) {
    // Never crash the job runner — log and continue
    console.error('[InventorySync] Error:', err);
  }
}
