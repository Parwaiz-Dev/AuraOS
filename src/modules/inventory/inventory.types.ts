import { z } from 'zod';

export const CreateInventoryItemRequestSchema = z.object({
  menu_item_id: z.string().uuid('Menu item ID must be a valid UUID'),
  current_stock: z.number().int().min(0, 'Current stock must be 0 or greater'),
  reorder_level: z.number().int().min(0, 'Reorder level must be 0 or greater'),
});

export const UpdateInventoryItemRequestSchema = z.object({
  current_stock: z.number().int().min(0, 'Current stock must be 0 or greater').optional(),
  // Also accept 'quantity' as an alias (frontend compatibility)
  quantity: z.number().int().min(0, 'Quantity must be 0 or greater').optional(),
  reorder_level: z.number().int().min(0, 'Reorder level must be 0 or greater').optional(),
}).transform((data) => ({
  current_stock: data.current_stock ?? data.quantity,
  reorder_level: data.reorder_level,
}));

export type CreateInventoryItemRequest = z.infer<typeof CreateInventoryItemRequestSchema>;
export type UpdateInventoryItemRequest = z.infer<typeof UpdateInventoryItemRequestSchema>;

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  menu_item_name?: string;
  menu_item_active?: boolean;
  current_stock: number;
  reorder_level: number;
  last_restocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryStats {
  total_items: number;
  low_stock_items: number;
  average_stock: number;
  total_stock: number;
}

export type TransactionType = 'RESTOCK' | 'ADJUSTMENT' | 'USAGE' | 'INITIAL';

export interface InventoryTransaction {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  menu_item_id: string;
  menu_item_name?: string;
  quantity_before: number;
  quantity_after: number;
  quantity_change: number;
  transaction_type: TransactionType;
  notes?: string | null;
  changed_by?: string | null;
  changed_by_name?: string | null;
  created_at: Date;
}
