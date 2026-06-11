import { z } from 'zod';

export const OrderItemRequestSchema = z.object({
  menu_item_id: z.string().uuid('Menu item ID must be a valid UUID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  special_instructions: z.string().max(500).optional(),
});

export const CreateOrderRequestSchema = z.object({
  table_id: z.string().uuid('Table ID must be a valid UUID').optional().nullable(),
  order_type: z.enum(['DINE_IN', 'PARCEL', 'ONLINE']),
  order_source: z.enum(['WAITER', 'RECEPTION', 'QR', 'WHATSAPP', 'ZOMATO']),
  special_instructions: z.string().max(1000).optional(),
  items: z.array(OrderItemRequestSchema).min(1, 'At least one order item is required'),
});

export const UpdateOrderRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
  special_instructions: z.string().max(1000).optional(),
});

export const AddOrderItemsRequestSchema = z.object({
  items: z.array(OrderItemRequestSchema).min(1, 'At least one item is required'),
});

export const UpdateOrderItemStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'DONE']),
});

export type OrderItemRequest = z.infer<typeof OrderItemRequestSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof UpdateOrderRequestSchema>;
export type AddOrderItemsRequest = z.infer<typeof AddOrderItemsRequestSchema>;

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_number: string;
  token_number: string | null;
  order_type: 'DINE_IN' | 'PARCEL' | 'ONLINE';
  order_source: 'WAITER' | 'RECEPTION' | 'QR' | 'WHATSAPP' | 'ZOMATO';
  status: 'CREATED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  total_amount: number;
  priority_score: number;
  special_instructions?: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  restaurant_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  special_instructions?: string;
  status: 'PENDING' | 'PREPARING' | 'DONE';
  created_at: Date;
  updated_at: Date;
}

export interface OrderStats {
  total_orders_today: number;
  completed_orders_today: number;
  cancelled_orders_today: number;
  delayed_orders_count: number;
  revenue_today: number;
}

/** Order item enriched with the resolved menu item name (from JOIN). */
export interface EnrichedOrderItem extends OrderItem {
  menu_item_name: string | null;
}

/** Order returned by list/detail endpoints — includes embedded table info and line items. */
export interface EnrichedOrder extends Order {
  table: { id: string; table_number: string } | null;
  order_items: EnrichedOrderItem[];
  items: EnrichedOrderItem[]; // alias — same array, for frontend compatibility
}

/** Minimal shape returned by updateItemStatus. */
export interface UpdatedOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  special_instructions?: string;
  status: 'PENDING' | 'PREPARING' | 'DONE';
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
