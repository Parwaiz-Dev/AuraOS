import { pool, query } from '@/config/database';
import { Order, OrderItem, OrderStats, EnrichedOrder, UpdatedOrderItem } from './orders.types';

export class OrdersRepository {
  async createOrderWithItems(
    restaurantId: string,
    tableId: string | null,
    orderNumber: string,
    orderType: string,
    orderSource: string,
    totalAmount: number,
    priorityScore: number,
    specialInstructions: string | null,
    createdBy: string | null,
    items: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      special_instructions: string | null;
      status: string;
    }>,
    initialStatus: string = 'CREATED',
    tokenNumber: string | null = null,
  ): Promise<{ order: Order; items: OrderItem[] }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const orderResult = await client.query(
        `INSERT INTO orders (restaurant_id, table_id, order_number, token_number, order_type, order_source, status, total_amount, priority_score, special_instructions, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, restaurant_id, table_id, order_number, token_number, order_type, order_source, status, total_amount, priority_score, special_instructions, created_by, created_at, updated_at, completed_at`,
        [
          restaurantId,
          tableId,
          orderNumber,
          tokenNumber,
          orderType,
          orderSource,
          initialStatus,
          totalAmount,
          priorityScore,
          specialInstructions,
          createdBy,
        ],
      );

      const order = orderResult.rows[0];
      const itemValues: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      items.forEach((item) => {
        placeholders.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
        );
        itemValues.push(
          order.id,
          restaurantId,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          item.special_instructions,
          item.status,
        );
      });

      const itemsResult = await client.query(
        `INSERT INTO order_items (order_id, restaurant_id, menu_item_id, quantity, unit_price, special_instructions, status)
         VALUES ${placeholders.join(", ")}
         RETURNING id, order_id, restaurant_id, menu_item_id, quantity, unit_price, special_instructions, status, created_at, updated_at`,
        itemValues,
      );

      await client.query("COMMIT");
      return { order, items: itemsResult.rows };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await query(
      "SELECT id, restaurant_id, table_id, order_number, token_number, order_type, order_source, status, total_amount, priority_score, special_instructions, created_by, created_at, updated_at, completed_at FROM orders WHERE id = $1 LIMIT 1",
      [orderId],
    );
    return result.rows[0] || null;
  }

  /**
   * Find a single order fully enriched with table info and line items
   * (each item includes the resolved menu_item_name). Matches the shape
   * returned by the list endpoint so the frontend can render consistently.
   */
  async findByIdWithDetails(orderId: string): Promise<EnrichedOrder | null> {
    const result = await query(
      `
      SELECT
        o.id, o.restaurant_id, o.table_id, o.order_number, o.order_type,
        o.order_source, o.status, o.total_amount, o.priority_score,
        o.special_instructions, o.created_by, o.created_at, o.updated_at, o.completed_at,
        rt.id AS table_join_id,
        rt.table_number,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'order_id', oi.order_id,
              'restaurant_id', oi.restaurant_id,
              'menu_item_id', oi.menu_item_id,
              'menu_item_name', mi.name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'special_instructions', oi.special_instructions,
              'status', oi.status,
              'modifiers', (
                SELECT COALESCE(
                  json_agg(
                    json_build_object(
                      'modifier_group_name', oim.modifier_group_name,
                      'modifier_option_name', oim.modifier_option_name,
                      'price_adjustment', oim.price_adjustment
                    )
                    ORDER BY oim.created_at ASC
                  ) FILTER (WHERE oim.id IS NOT NULL),
                  '[]'::json
                )
                FROM order_item_modifiers oim
                WHERE oim.order_item_id = oi.id
              )
            )
            ORDER BY oi.created_at ASC
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS order_items
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.id = $1
      GROUP BY o.id, rt.id
      `,
      [orderId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      ...row,
      table: row.table_number
        ? { id: row.table_join_id, table_number: row.table_number }
        : null,
      order_items: row.order_items || [],
      items: row.order_items || [],
    };
  }

  /**
   * Find the most recent active (open) order for a table.
   * Active = not COMPLETED and not CANCELLED.
   */
  async findActiveByTableId(restaurantId: string, tableId: string): Promise<Order | null> {
    const result = await query(
      `SELECT id, restaurant_id, table_id, order_number, token_number, order_type, order_source, status, total_amount, priority_score, special_instructions, created_by, created_at, updated_at, completed_at
       FROM orders
       WHERE restaurant_id = $1
         AND table_id = $2
         AND status NOT IN ('COMPLETED', 'CANCELLED')
       ORDER BY created_at DESC
       LIMIT 1`,
      [restaurantId, tableId],
    );
    return result.rows[0] || null;
  }

  /**
   * Add items to an existing order inside a transaction and recompute the total.
   * If an identical line (same menu_item + same instructions) already exists,
   * its quantity is incremented instead of inserting a duplicate row.
   */
  async addItemsToOrder(
    orderId: string,
    restaurantId: string,
    items: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      special_instructions: string | null;
      status: string;
    }>,
  ): Promise<{ order: Order; items: OrderItem[] }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock the order row so that concurrent createPaymentAtomic calls on the
      // same order block until this transaction commits.  Without this lock a
      // payment could read total_amount before the new items are added, then
      // validate and insert against a stale (lower) total.
      await client.query(
        `SELECT id FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      );

      for (const item of items) {
        // Try to merge with an existing pending line for the same item + instructions
        const existing = await client.query(
          `SELECT id, quantity FROM order_items
           WHERE order_id = $1
             AND menu_item_id = $2
             AND COALESCE(special_instructions, '') = COALESCE($3, '')
             AND status = 'PENDING'
           LIMIT 1`,
          [orderId, item.menu_item_id, item.special_instructions],
        );

        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE order_items
             SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [item.quantity, existing.rows[0].id],
          );
        } else {
          await client.query(
            `INSERT INTO order_items (order_id, restaurant_id, menu_item_id, quantity, unit_price, special_instructions, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              orderId,
              restaurantId,
              item.menu_item_id,
              item.quantity,
              item.unit_price,
              item.special_instructions,
              item.status,
            ],
          );
        }
      }

      // Recompute total from all line items
      await client.query(
        `UPDATE orders
         SET total_amount = (
           SELECT COALESCE(SUM(quantity * unit_price), 0)
           FROM order_items WHERE order_id = $1
         ),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId],
      );

      const orderResult = await client.query(
        `SELECT id, restaurant_id, table_id, order_number, token_number, order_type, order_source, status, total_amount, priority_score, special_instructions, created_by, created_at, updated_at, completed_at
         FROM orders WHERE id = $1`,
        [orderId],
      );

      const itemsResult = await client.query(
        `SELECT id, order_id, restaurant_id, menu_item_id, quantity, unit_price, special_instructions, status, created_at, updated_at
         FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
        [orderId],
      );

      await client.query("COMMIT");
      return { order: orderResult.rows[0], items: itemsResult.rows };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    const result = await query(
      "SELECT id, order_id, restaurant_id, menu_item_id, quantity, unit_price, special_instructions, status, created_at, updated_at FROM order_items WHERE order_id = $1 ORDER BY created_at ASC",
      [orderId],
    );
    return result.rows;
  }

  async findByRestaurantId(
    restaurantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<EnrichedOrder[]> {
    const result = await query(
      `
    SELECT
      o.id,
      o.restaurant_id,
      o.table_id,
      o.order_number,
      o.order_type,
      o.order_source,
      o.status,
      o.total_amount,
      o.priority_score,
      o.special_instructions,
      o.created_by,
      o.created_at,
      o.updated_at,
      o.completed_at,

      rt.id AS table_join_id,
      rt.table_number,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'restaurant_id', oi.restaurant_id,
            'menu_item_id', oi.menu_item_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'special_instructions', oi.special_instructions
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS order_items

    FROM orders o

    LEFT JOIN restaurant_tables rt
      ON o.table_id = rt.id

    LEFT JOIN order_items oi
      ON oi.order_id = o.id

    WHERE o.restaurant_id = $1

    GROUP BY o.id, rt.id

    ORDER BY o.created_at DESC

    LIMIT $2 OFFSET $3
    `,
      [restaurantId, limit, offset],
    );

    return result.rows.map((row) => ({
      ...row,

      table: row.table_number
        ? {
            id: row.table_join_id,
            table_number: row.table_number,
          }
        : null,

      order_items: row.order_items || [],
    }));
  }

  async update(
    orderId: string,
    updates: Partial<{
      status: string;
      special_instructions: string | null;
      completed_at: Date | null;
    }>,
  ): Promise<Order | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.special_instructions !== undefined) {
      fields.push(`special_instructions = $${paramIndex++}`);
      values.push(updates.special_instructions);
    }
    if (updates.completed_at !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completed_at);
    }

    if (fields.length === 0) {
      return this.findById(orderId);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(orderId);

    const result = await query(
      `UPDATE orders SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING id, restaurant_id, table_id, order_number, token_number, order_type, order_source, status, total_amount, priority_score, special_instructions, created_by, created_at, updated_at, completed_at`,
      values,
    );
    return result.rows[0] || null;
  }

  async delete(orderId: string): Promise<boolean> {
    const result = await query("DELETE FROM orders WHERE id = $1", [orderId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update the status of a single order item.
   * Returns the updated item, or null if not found.
   */
  async updateItemStatus(
    itemId: string,
    orderId: string,
    status: 'PENDING' | 'PREPARING' | 'DONE',
  ): Promise<UpdatedOrderItem | null> {
    const completedAt = status === 'DONE' ? new Date() : null;
    const result = await query(
      `UPDATE order_items
       SET status = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND order_id = $4
       RETURNING id, order_id, menu_item_id, quantity, unit_price, special_instructions, status, completed_at, created_at, updated_at`,
      [status, completedAt, itemId, orderId],
    );
    return result.rows[0] || null;
  }

  /**
   * Check if all items in an order are DONE.
   * Used to auto-advance the order to READY when kitchen finishes all dishes.
   */
  async allItemsDone(orderId: string): Promise<boolean> {
    const result = await query(
      `SELECT COUNT(*) FILTER (WHERE status != 'DONE') AS pending_count
       FROM order_items WHERE order_id = $1`,
      [orderId],
    );
    return parseInt(result.rows[0].pending_count, 10) === 0;
  }

  async getStats(restaurantId: string): Promise<OrderStats> {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE DATE(o.created_at) = CURRENT_DATE) as total_orders_today,
        COUNT(*) FILTER (WHERE o.status = 'COMPLETED' AND DATE(o.created_at) = CURRENT_DATE) as completed_orders_today,
        COUNT(*) FILTER (WHERE o.status = 'CANCELLED' AND DATE(o.created_at) = CURRENT_DATE) as cancelled_orders_today,
        COUNT(*) FILTER (
          WHERE o.status NOT IN ('COMPLETED', 'CANCELLED')
          AND NOW() > o.created_at + (r.delay_threshold_minutes || ' minutes')::interval
        ) as delayed_orders_count,
        COALESCE(SUM(o.total_amount) FILTER (WHERE DATE(o.created_at) = CURRENT_DATE), 0) as revenue_today
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.restaurant_id = $1`,
      [restaurantId],
    );
    const stats = result.rows[0];
    return {
      total_orders_today: parseInt(stats.total_orders_today) || 0,
      completed_orders_today: parseInt(stats.completed_orders_today) || 0,
      cancelled_orders_today: parseInt(stats.cancelled_orders_today) || 0,
      delayed_orders_count: parseInt(stats.delayed_orders_count) || 0,
      revenue_today: parseFloat(stats.revenue_today) || 0,
    };
  }
}

export const ordersRepository = new OrdersRepository();