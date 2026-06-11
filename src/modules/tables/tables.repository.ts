import { query } from '@/config/database';
import { Table, TableStats } from './tables.types';

export class TablesRepository {
  /**
   * Create a new table
   */
  async create(
    restaurantId: string,
    tableNumber: string,
    seats: number = 2,
    isActive: boolean = true
  ): Promise<Table> {
    const result = await query(
      `INSERT INTO restaurant_tables (restaurant_id, table_number, seats, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, restaurant_id, table_number, seats, is_active, created_at, updated_at`,
      [restaurantId, tableNumber, seats, isActive]
    );
    return result.rows[0];
  }

  /**
   * Find table by ID
   */
  async findById(tableId: string): Promise<Table | null> {
    const result = await query(
      'SELECT id, restaurant_id, table_number, seats, is_active, created_at, updated_at FROM restaurant_tables WHERE id = $1 LIMIT 1',
      [tableId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find table by restaurant ID and table number
   */
  async findByRestaurantAndNumber(restaurantId: string, tableNumber: string): Promise<Table | null> {
    const result = await query(
      'SELECT id, restaurant_id, table_number, seats, is_active, created_at, updated_at FROM restaurant_tables WHERE restaurant_id = $1 AND table_number = $2 LIMIT 1',
      [restaurantId, tableNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all tables for a restaurant
   */
  async findByRestaurantId(restaurantId: string, limit: number = 50, offset: number = 0): Promise<Table[]> {
    const result = await query(
      'SELECT id, restaurant_id, table_number, seats, is_active, created_at, updated_at FROM restaurant_tables WHERE restaurant_id = $1 ORDER BY table_number ASC LIMIT $2 OFFSET $3',
      [restaurantId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Find all tables for a restaurant ENRICHED with their current active order.
   *
   * This powers the "Tables command center" view used by waiters / reception.
   * For each table we LEFT JOIN the most-recent active order (status not in
   * COMPLETED / CANCELLED) so the UI can colour-code occupancy:
   *   - no active order        → table is FREE
   *   - active order present   → table is OCCUPIED (shows ₹ amount + status)
   *   - active order = READY   → table is READY-TO-SERVE / READY-TO-PAY
   *
   * A correlated subquery (LATERAL) is used so we only pull ONE order per
   * table even if (rarely) more than one open order exists.
   */
  async findAllWithOrderStatus(restaurantId: string): Promise<any[]> {
    const result = await query(
      `
      SELECT
        t.id, t.restaurant_id, t.table_number, t.seats, t.is_active,
        t.created_at, t.updated_at,
        ao.id              AS active_order_id,
        ao.order_number    AS active_order_number,
        ao.status          AS active_order_status,
        ao.total_amount    AS active_order_total,
        ao.order_type      AS active_order_type,
        ao.created_at      AS active_order_created_at,
        ao.item_count      AS active_order_item_count
      FROM restaurant_tables t
      LEFT JOIN LATERAL (
        SELECT
          o.id, o.order_number, o.status, o.total_amount, o.order_type, o.created_at,
          (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
        FROM orders o
        WHERE o.table_id = t.id
          AND o.restaurant_id = t.restaurant_id
          AND o.status NOT IN ('COMPLETED', 'CANCELLED')
        ORDER BY o.created_at DESC
        LIMIT 1
      ) ao ON true
      WHERE t.restaurant_id = $1
      ORDER BY t.table_number ASC
      `,
      [restaurantId]
    );

    // Reshape flat rows into a clean { ...table, active_order: {...} | null } object
    return result.rows.map((row) => ({
      id: row.id,
      restaurant_id: row.restaurant_id,
      table_number: row.table_number,
      seats: row.seats,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      active_order: row.active_order_id
        ? {
            id: row.active_order_id,
            order_number: row.active_order_number,
            status: row.active_order_status,
            total_amount: Number(row.active_order_total) || 0,
            order_type: row.active_order_type,
            created_at: row.active_order_created_at,
            item_count: Number(row.active_order_item_count) || 0,
          }
        : null,
    }));
  }

  /**
   * Update table
   */
  async update(
    tableId: string,
    updates: Partial<{
      table_number: string;
      seats: number;
      is_active: boolean;
    }>
  ): Promise<Table | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.table_number !== undefined) {
      fields.push(`table_number = $${paramIndex++}`);
      values.push(updates.table_number);
    }
    if (updates.seats !== undefined) {
      fields.push(`seats = $${paramIndex++}`);
      values.push(updates.seats);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return this.findById(tableId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tableId);

    const result = await query(
      `UPDATE restaurant_tables SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, restaurant_id, table_number, seats, is_active, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete table
   */
  async delete(tableId: string): Promise<boolean> {
    const result = await query('DELETE FROM restaurant_tables WHERE id = $1', [tableId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if table number exists for restaurant
   */
  async tableNumberExists(restaurantId: string, tableNumber: string, excludeId?: string): Promise<boolean> {
    let queryText = 'SELECT 1 FROM restaurant_tables WHERE restaurant_id = $1 AND table_number = $2';
    const params = [restaurantId, tableNumber];

    if (excludeId) {
      queryText += ' AND id != $3';
      params.push(excludeId);
    }

    queryText += ' LIMIT 1';

    const result = await query(queryText, params);
    return result.rows.length > 0;
  }

  /**
   * Get table statistics for restaurant
   */
  async getStats(restaurantId: string): Promise<TableStats> {
    const result = await query(
      `SELECT
        COUNT(*) as total_tables,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_tables,
        COALESCE(SUM(seats), 0) as total_seats,
        COALESCE(SUM(CASE WHEN is_active = true THEN seats ELSE 0 END), 0) as active_seats
       FROM restaurant_tables
       WHERE restaurant_id = $1`,
      [restaurantId]
    );

    const stats = result.rows[0];
    return {
      total_tables: parseInt(stats.total_tables) || 0,
      active_tables: parseInt(stats.active_tables) || 0,
      total_seats: parseInt(stats.total_seats) || 0,
      active_seats: parseInt(stats.active_seats) || 0,
    };
  }

  /**
   * Count total tables for restaurant
   */
  async count(restaurantId: string): Promise<number> {
    const result = await query('SELECT COUNT(*) as count FROM restaurant_tables WHERE restaurant_id = $1', [restaurantId]);
    return parseInt(result.rows[0].count) || 0;
  }
}

export const tablesRepository = new TablesRepository();