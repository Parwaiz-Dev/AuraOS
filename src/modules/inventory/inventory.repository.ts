import { query } from '@/config/database';
import { InventoryItem, InventoryStats, InventoryTransaction, TransactionType } from './inventory.types';

export class InventoryRepository {
  async create(
    restaurantId: string,
    menuItemId: string,
    currentStock: number,
    reorderLevel: number
  ): Promise<InventoryItem> {
    const result = await query(
      `INSERT INTO inventory_items (restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING id, restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at, created_at, updated_at`,
      [restaurantId, menuItemId, currentStock, reorderLevel]
    );
    return result.rows[0];
  }

  async findById(itemId: string): Promise<InventoryItem | null> {
    const result = await query(
      `SELECT id, restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at, created_at, updated_at
       FROM inventory_items
       WHERE id = $1
       LIMIT 1`,
      [itemId]
    );
    return result.rows[0] || null;
  }

  async findByRestaurantId(restaurantId: string, limit: number = 50, offset: number = 0): Promise<InventoryItem[]> {
    const result = await query(
      `SELECT
         i.id, i.restaurant_id, i.menu_item_id,
         mi.name AS menu_item_name,
         mi.is_active AS menu_item_active,
         i.current_stock, i.reorder_level,
         i.last_restocked_at, i.created_at, i.updated_at
       FROM inventory_items i
       JOIN menu_items mi ON mi.id = i.menu_item_id
       WHERE i.restaurant_id = $1
       ORDER BY mi.name ASC
       LIMIT $2 OFFSET $3`,
      [restaurantId, limit, offset]
    );
    return result.rows;
  }

  async findByMenuItemId(menuItemId: string): Promise<InventoryItem | null> {
    const result = await query(
      `SELECT id, restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at, created_at, updated_at
       FROM inventory_items
       WHERE menu_item_id = $1
       LIMIT 1`,
      [menuItemId]
    );
    return result.rows[0] || null;
  }

  async update(itemId: string, updates: Partial<{ current_stock: number; reorder_level: number }>): Promise<InventoryItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.current_stock !== undefined) {
      fields.push(`current_stock = $${paramIndex++}`);
      values.push(updates.current_stock);
      // Only update last_restocked_at when stock is being added, not reduced
      fields.push(`last_restocked_at = CASE WHEN $${paramIndex} > current_stock THEN CURRENT_TIMESTAMP ELSE last_restocked_at END`);
      values.push(updates.current_stock);
      paramIndex++;
    }
    if (updates.reorder_level !== undefined) {
      fields.push(`reorder_level = $${paramIndex++}`);
      values.push(updates.reorder_level);
    }

    if (fields.length === 0) {
      return this.findById(itemId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(itemId);

    const result = await query(
      `UPDATE inventory_items SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(itemId: string): Promise<boolean> {
    const result = await query('DELETE FROM inventory_items WHERE id = $1', [itemId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Atomically decrement stock for a menu item when a kitchen item is marked DONE.
   * Uses GREATEST(0, current_stock - qty) to prevent negative stock.
   * Returns null if no inventory record exists for this item — silently skipped,
   * so the order flow never fails due to missing inventory setup.
   */
  async decrementStockForMenuItem(
    restaurantId: string,
    menuItemId: string,
    quantity: number,
  ): Promise<InventoryItem | null> {
    const result = await query(
      `UPDATE inventory_items
       SET current_stock = GREATEST(0, current_stock - $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE restaurant_id = $2 AND menu_item_id = $3
       RETURNING id, restaurant_id, menu_item_id, current_stock, reorder_level, last_restocked_at, created_at, updated_at`,
      [quantity, restaurantId, menuItemId],
    );
    return result.rows[0] || null;
  }

  async itemExists(restaurantId: string, menuItemId: string, excludeId?: string): Promise<boolean> {
    const params = [restaurantId, menuItemId];
    let sql = `SELECT 1 FROM inventory_items WHERE restaurant_id = $1 AND menu_item_id = $2`;
    if (excludeId) {
      sql += ` AND id != $3`;
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(restaurantId: string): Promise<InventoryStats> {
    const result = await query(
      `SELECT
         COUNT(*) AS total_items,
         COUNT(*) FILTER (WHERE current_stock <= reorder_level) AS low_stock_items,
         COALESCE(AVG(current_stock), 0) AS average_stock,
         COALESCE(SUM(current_stock), 0) AS total_stock
       FROM inventory_items
       WHERE restaurant_id = $1`,
      [restaurantId]
    );

    const stats = result.rows[0];
    return {
      total_items: parseInt(stats.total_items, 10) || 0,
      low_stock_items: parseInt(stats.low_stock_items, 10) || 0,
      average_stock: parseFloat(stats.average_stock) || 0,
      total_stock: parseInt(stats.total_stock, 10) || 0,
    };
  }

  // ── History / transaction log ─────────────────────────────────────────────

  /**
   * Log a stock change to the inventory_transactions table.
   * Called every time stock is adjusted — creates an immutable audit trail.
   */
  async logTransaction(
    restaurantId: string,
    inventoryItemId: string,
    menuItemId: string,
    quantityBefore: number,
    quantityAfter: number,
    transactionType: TransactionType,
    notes: string | null,
    changedBy: string | null,
  ): Promise<void> {
    await query(
      `INSERT INTO inventory_transactions
         (restaurant_id, inventory_item_id, menu_item_id,
          quantity_before, quantity_after, quantity_change,
          transaction_type, notes, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        restaurantId,
        inventoryItemId,
        menuItemId,
        quantityBefore,
        quantityAfter,
        quantityAfter - quantityBefore,
        transactionType,
        notes,
        changedBy,
      ],
    );
  }

  /**
   * Get transaction history for a single inventory item.
   * Returns most recent first.
   */
  async getHistory(
    inventoryItemId: string,
    limit = 50,
    offset = 0,
  ): Promise<InventoryTransaction[]> {
    const result = await query(
      `SELECT
         t.id, t.restaurant_id, t.inventory_item_id, t.menu_item_id,
         mi.name AS menu_item_name,
         t.quantity_before, t.quantity_after, t.quantity_change,
         t.transaction_type, t.notes,
         t.changed_by,
         u.name AS changed_by_name,
         t.created_at
       FROM inventory_transactions t
       JOIN menu_items mi ON mi.id = t.menu_item_id
       LEFT JOIN users u ON u.id = t.changed_by
       WHERE t.inventory_item_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [inventoryItemId, limit, offset],
    );
    return result.rows;
  }

  /**
   * Get recent transactions across all items for a restaurant.
   * Used for the inventory history overview page.
   */
  async getRestaurantHistory(
    restaurantId: string,
    limit = 100,
    offset = 0,
  ): Promise<InventoryTransaction[]> {
    const result = await query(
      `SELECT
         t.id, t.restaurant_id, t.inventory_item_id, t.menu_item_id,
         mi.name AS menu_item_name,
         t.quantity_before, t.quantity_after, t.quantity_change,
         t.transaction_type, t.notes,
         t.changed_by,
         u.name AS changed_by_name,
         t.created_at
       FROM inventory_transactions t
       JOIN menu_items mi ON mi.id = t.menu_item_id
       LEFT JOIN users u ON u.id = t.changed_by
       WHERE t.restaurant_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [restaurantId, limit, offset],
    );
    return result.rows;
  }
}

export const inventoryRepository = new InventoryRepository();
