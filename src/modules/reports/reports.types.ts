import { z } from 'zod';

export const TopItemsQuerySchema = z.object({
  limit: z.preprocess((value) => Number(value), z.number().int().min(1).max(50).default(10)),
});

export const DailyRevenueQuerySchema = z.object({
  days: z.preprocess((value) => Number(value), z.number().int().min(1).max(90).default(7)),
});

export type TopItemsQuery = z.infer<typeof TopItemsQuerySchema>;
export type DailyRevenueQuery = z.infer<typeof DailyRevenueQuerySchema>;

export interface DashboardReport {
  total_orders_today: number;
  completed_orders_today: number;
  cancelled_orders_today: number;
  revenue_today: number;
  payments_today: number;
  paid_amount_today: number;
  refunded_amount_today: number;
  low_stock_items: number;
  occupied_tables: number;
  active_orders: number;
}

export interface TopSellingItem {
  menu_item_id: string;
  name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface DailyRevenuePoint {
  date: string;
  revenue: number;
}

export interface InventoryAlert {
  inventory_item_id: string;
  menu_item_id: string;
  menu_item_name: string;
  current_stock: number;
  reorder_level: number;
}
