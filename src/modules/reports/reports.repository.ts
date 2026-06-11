import { query } from "@/config/database";
import {
  DashboardReport,
  DailyRevenuePoint,
  InventoryAlert,
  TopSellingItem,
} from "./reports.types";

export class ReportsRepository {
  async getDashboardReport(restaurantId: string): Promise<DashboardReport> {
    const result = await query(
      `SELECT
         (SELECT COUNT(*)
          FROM orders
          WHERE restaurant_id = $1
          AND DATE(created_at) = CURRENT_DATE) AS total_orders_today,

         (SELECT COUNT(*)
          FROM orders
          WHERE restaurant_id = $1
          AND status = 'COMPLETED'
          AND DATE(created_at) = CURRENT_DATE) AS completed_orders_today,

         (SELECT COUNT(*)
          FROM orders
          WHERE restaurant_id = $1
          AND status = 'CANCELLED'
          AND DATE(created_at) = CURRENT_DATE) AS cancelled_orders_today,

         (SELECT COUNT(*)
          FROM orders
          WHERE restaurant_id = $1
          AND status NOT IN ('COMPLETED', 'CANCELLED')
          AND DATE(created_at) = CURRENT_DATE) AS active_orders,

         (SELECT COALESCE(SUM(total_amount), 0)
          FROM orders
          WHERE restaurant_id = $1
          AND status = 'COMPLETED'
          AND DATE(created_at) = CURRENT_DATE) AS revenue_today,

         (SELECT COUNT(*)
          FROM payments
          WHERE restaurant_id = $1
          AND DATE(created_at) = CURRENT_DATE) AS payments_today,

         (SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE restaurant_id = $1
          AND status = 'PAID'
          AND DATE(created_at) = CURRENT_DATE) AS paid_amount_today,

         (SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE restaurant_id = $1
          AND status = 'REFUNDED'
          AND DATE(created_at) = CURRENT_DATE) AS refunded_amount_today,

         (SELECT COUNT(*)
          FROM inventory_items
          WHERE restaurant_id = $1
          AND current_stock <= reorder_level) AS low_stock_items,

         (SELECT COUNT(DISTINCT o.table_id)
          FROM orders o
          WHERE o.restaurant_id = $1
          AND o.table_id IS NOT NULL
          AND o.status NOT IN ('COMPLETED', 'CANCELLED')) AS occupied_tables
      `,
      [restaurantId],
    );

    const row = result.rows[0];

    return {
      total_orders_today: parseInt(row.total_orders_today, 10) || 0,
      completed_orders_today: parseInt(row.completed_orders_today, 10) || 0,
      cancelled_orders_today: parseInt(row.cancelled_orders_today, 10) || 0,
      active_orders: parseInt(row.active_orders, 10) || 0,
      revenue_today: parseFloat(row.revenue_today) || 0,
      payments_today: parseInt(row.payments_today, 10) || 0,
      paid_amount_today: parseFloat(row.paid_amount_today) || 0,
      refunded_amount_today: parseFloat(row.refunded_amount_today) || 0,
      low_stock_items: parseInt(row.low_stock_items, 10) || 0,
      occupied_tables: parseInt(row.occupied_tables, 10) || 0,
    };
  }

  async getTopSellingItems(
    restaurantId: string,
    limit: number,
  ): Promise<TopSellingItem[]> {
    const result = await query(
      `SELECT
         oi.menu_item_id,
         mi.name,
         SUM(oi.quantity) AS total_quantity,
         COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE o.restaurant_id = $1
       GROUP BY oi.menu_item_id, mi.name
       ORDER BY total_quantity DESC
       LIMIT $2`,
      [restaurantId, limit],
    );

    return result.rows.map((row) => ({
      menu_item_id: row.menu_item_id,
      name: row.name,
      total_quantity: parseInt(row.total_quantity, 10) || 0,

      total_revenue: parseFloat(row.total_revenue) || 0,
    }));
  }

  async getDailyRevenue(
    restaurantId: string,
    days: number,
  ): Promise<DailyRevenuePoint[]> {
    const result = await query(
      `SELECT
         to_char(date_series, 'YYYY-MM-DD') AS date,
         COALESCE(SUM(o.total_amount), 0)
           - COALESCE((
               SELECT SUM(p.amount)
               FROM payments p
               WHERE p.restaurant_id = $1
                 AND p.status = 'REFUNDED'
                 AND DATE(p.created_at) = date_series
             ), 0) AS revenue
       FROM generate_series(
         CURRENT_DATE - ($2 - 1) * INTERVAL '1 day',
         CURRENT_DATE,
         '1 day'
       ) AS date_series
       LEFT JOIN orders o
         ON DATE(o.created_at) = date_series
         AND o.restaurant_id = $1
         AND o.status = 'COMPLETED'
       GROUP BY date_series
       ORDER BY date_series ASC`,
      [restaurantId, days],
    );

    return result.rows.map((row) => ({
      date: row.date,
      revenue: parseFloat(row.revenue) || 0,
    }));
  }

  async getInventoryAlerts(restaurantId: string): Promise<InventoryAlert[]> {
    const result = await query(
      `SELECT
         i.id AS inventory_item_id,
         i.menu_item_id,
         mi.name AS menu_item_name,
         i.current_stock,
         i.reorder_level
       FROM inventory_items i
       JOIN menu_items mi
         ON mi.id = i.menu_item_id
       WHERE i.restaurant_id = $1
       AND i.current_stock <= i.reorder_level
       ORDER BY i.current_stock ASC`,
      [restaurantId],
    );

    return result.rows.map((row) => ({
      inventory_item_id: row.inventory_item_id,
      menu_item_id: row.menu_item_id,
      menu_item_name: row.menu_item_name,
      current_stock: parseInt(row.current_stock, 10) || 0,

      reorder_level: parseInt(row.reorder_level, 10) || 0,
    }));
  }
}

export const reportsRepository = new ReportsRepository();
