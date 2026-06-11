import { ordersRepository } from '@/modules/orders/orders.repository';
import { menuRepository } from '@/modules/menu/menu.repository';
import { query } from '@/config/database';
import {
  ZomatoOrderWebhook,
  ZomatoItemMapping,
  UpsertMappingRequest,
} from './zomato.types';
import { ConflictError, NotFoundError } from '@/shared/errors/AppError';

export class ZomatoService {

  // ── Item mapping CRUD ─────────────────────────────────────────────────────

  /**
   * Get all item mappings for a restaurant.
   * Joins menu_items to show the menu item name alongside the Zomato item ID.
   */
  async getMappings(restaurantId: string): Promise<ZomatoItemMapping[]> {
    const result = await query(
      `SELECT
         m.id, m.restaurant_id, m.zomato_item_id, m.zomato_item_name,
         m.menu_item_id, mi.name AS menu_item_name,
         m.created_at, m.updated_at
       FROM zomato_item_mappings m
       JOIN menu_items mi ON mi.id = m.menu_item_id
       WHERE m.restaurant_id = $1
       ORDER BY m.zomato_item_name ASC, m.zomato_item_id ASC`,
      [restaurantId],
    );
    return result.rows;
  }

  /**
   * Create or update a mapping (upsert).
   * If a mapping for this Zomato item ID already exists, update it.
   */
  async upsertMapping(
    restaurantId: string,
    payload: UpsertMappingRequest,
  ): Promise<ZomatoItemMapping> {
    // Verify the menu item belongs to this restaurant
    const menuItem = await menuRepository.findMenuItemById(payload.menu_item_id);
    if (!menuItem || menuItem.restaurant_id !== restaurantId) {
      throw new NotFoundError('Menu item not found in this restaurant');
    }

    const result = await query(
      `INSERT INTO zomato_item_mappings
         (restaurant_id, zomato_item_id, zomato_item_name, menu_item_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (restaurant_id, zomato_item_id)
       DO UPDATE SET
         menu_item_id     = EXCLUDED.menu_item_id,
         zomato_item_name = EXCLUDED.zomato_item_name,
         updated_at       = CURRENT_TIMESTAMP
       RETURNING id, restaurant_id, zomato_item_id, zomato_item_name, menu_item_id, created_at, updated_at`,
      [restaurantId, payload.zomato_item_id, payload.zomato_item_name ?? null, payload.menu_item_id],
    );

    return { ...result.rows[0], menu_item_name: menuItem.name };
  }

  /**
   * Delete a mapping by ID.
   */
  async deleteMapping(mappingId: string, restaurantId: string): Promise<void> {
    const result = await query(
      `DELETE FROM zomato_item_mappings WHERE id = $1 AND restaurant_id = $2`,
      [mappingId, restaurantId],
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError('Mapping not found');
    }
  }

  /**
   * Look up a single mapping by Zomato item ID.
   * Returns null if no mapping exists.
   */
  private async findMapping(
    restaurantId: string,
    zomatoItemId: string,
  ): Promise<{ menu_item_id: string } | null> {
    const result = await query(
      `SELECT menu_item_id FROM zomato_item_mappings
       WHERE restaurant_id = $1 AND zomato_item_id = $2 LIMIT 1`,
      [restaurantId, zomatoItemId],
    );
    return result.rows[0] || null;
  }

  // ── Webhook processing ────────────────────────────────────────────────────

  /**
   * Process an incoming Zomato webhook order.
   *
   * For each item in the Zomato order:
   *   1. Look up the mapping (Zomato item ID → our menu item UUID)
   *   2. If mapped: use our menu item's price (authoritative)
   *   3. If NOT mapped: log as unmapped, use Zomato's price as fallback
   *      (order is still created — admin can add the mapping later)
   */
  async processZomatoOrder(restaurantId: string, payload: ZomatoOrderWebhook): Promise<{
    order_id: string;
    unmapped_items: string[];
  }> {
    const { order_id, items, total_amount, customer_name, customer_phone, delivery_address, notes } = payload;

    // Deduplication check
    const existingLog = await query(
      'SELECT id FROM integration_logs WHERE restaurant_id = $1 AND source = $2 AND external_id = $3',
      [restaurantId, 'ZOMATO', order_id],
    );
    if ((existingLog.rowCount ?? 0) > 0) {
      throw new ConflictError('Zomato order already imported');
    }

    const unmappedItems: string[] = [];
    const orderItems: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      special_instructions: string | null;
      status: 'PENDING';
    }> = [];

    for (const item of items) {
      const mapping = await this.findMapping(restaurantId, item.item_id);

      if (mapping) {
        // Mapped — use our menu item (fetch current price)
        const menuItem = await menuRepository.findMenuItemById(mapping.menu_item_id);
        orderItems.push({
          menu_item_id:         mapping.menu_item_id,
          quantity:             item.quantity,
          unit_price:           menuItem?.price ?? item.price, // prefer our price
          special_instructions: null,
          status:               'PENDING',
        });
      } else {
        // Not mapped — use Zomato's item_id as a placeholder
        // This will show as a UUID in the order, but the order still goes through
        unmappedItems.push(`${item.item_name} (ID: ${item.item_id})`);

        // We can't use item.item_id as a menu_item_id (it's not a UUID)
        // Skip this item — it will be noted in the order's special_instructions
        // Admin should add the mapping and the order can be manually corrected
      }
    }

    // If ALL items are unmapped, we can't create the order
    if (orderItems.length === 0) {
      const errorMsg = `All items unmapped: ${unmappedItems.join(', ')}. Add mappings in Zomato Settings.`;
      await this.logFailedOrder(restaurantId, order_id, errorMsg, payload);
      throw new Error(errorMsg);
    }

    // Recalculate total from mapped items only
    const mappedTotal = orderItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    const noteParts = [
      `Customer: ${customer_name}`,
      `Phone: ${customer_phone}`,
      delivery_address ? `Address: ${delivery_address}` : null,
      notes || null,
      unmappedItems.length > 0
        ? `⚠️ Unmapped items (not included): ${unmappedItems.join(', ')}`
        : null,
    ].filter(Boolean).join(' | ');

    const orderNumber = `ZOMATO-${order_id}`;

    const { order } = await ordersRepository.createOrderWithItems(
      restaurantId,
      null,
      orderNumber,
      'ONLINE',
      'ZOMATO',
      mappedTotal,
      10,
      noteParts,
      null,
      orderItems,
    );

    // Log success
    await query(
      `INSERT INTO integration_logs (restaurant_id, source, status, payload, external_id, order_id)
       VALUES ($1, 'ZOMATO', 'PROCESSED', $2, $3, $4)`,
      [restaurantId, JSON.stringify(payload), order_id, order.id],
    );

    return { order_id: order.id, unmapped_items: unmappedItems };
  }

  // ── Sync status ───────────────────────────────────────────────────────────

  async getSyncStatus(restaurantId: string): Promise<{
    last_sync: Date | null;
    total_synced: number;
    total_failed: number;
    unmapped_count: number;
  }> {
    const [logsResult, mappingResult] = await Promise.all([
      query(
        `SELECT
           MAX(created_at) as last_sync,
           COUNT(*) FILTER (WHERE status = 'PROCESSED') as total_synced,
           COUNT(*) FILTER (WHERE status = 'FAILED') as total_failed
         FROM integration_logs
         WHERE restaurant_id = $1 AND source = 'ZOMATO'`,
        [restaurantId],
      ),
      query(
        `SELECT COUNT(*) as mapping_count FROM zomato_item_mappings WHERE restaurant_id = $1`,
        [restaurantId],
      ),
    ]);

    const row = logsResult.rows[0];
    return {
      last_sync:      row.last_sync ? new Date(row.last_sync) : null,
      total_synced:   parseInt(row.total_synced, 10) || 0,
      total_failed:   parseInt(row.total_failed, 10) || 0,
      unmapped_count: parseInt(mappingResult.rows[0].mapping_count, 10) || 0,
    };
  }

  async logFailedOrder(restaurantId: string, externalOrderId: string, error: string, payload: any): Promise<void> {
    await query(
      `INSERT INTO integration_logs (restaurant_id, source, status, payload, error_message, external_id)
       VALUES ($1, 'ZOMATO', 'FAILED', $2, $3, $4)`,
      [restaurantId, JSON.stringify(payload), error, externalOrderId],
    );
  }
}

export const zomatoService = new ZomatoService();
