import { z } from 'zod';

/**
 * Zomato API payload types
 */
export const ZomatoOrderWebhookSchema = z.object({
  order_id: z.string(),
  restaurant_id: z.string(),
  customer_name: z.string(),
  customer_phone: z.string(),
  delivery_address: z.string().optional(),
  items: z.array(
    z.object({
      item_id: z.string(),
      item_name: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })
  ),
  total_amount: z.number().positive(),
  status: z.enum(['RECEIVED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
  notes: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type ZomatoOrderWebhook = z.infer<typeof ZomatoOrderWebhookSchema>;

export interface ZomatoIntegrationConfig {
  api_key: string;
  webhook_secret: string;
  restaurant_id: string;
  restaurant_name: string;
}

export interface ZomatoSyncResult {
  orders_imported: number;
  orders_failed: number;
  errors: Array<{ order_id: string; error: string }>;
}

// ── Item mapping ──────────────────────────────────────────────────────────────

export interface ZomatoItemMapping {
  id: string;
  restaurant_id: string;
  zomato_item_id: string;
  zomato_item_name?: string | null;
  menu_item_id: string;
  menu_item_name?: string;
  created_at: Date;
  updated_at: Date;
}

export const UpsertMappingSchema = z.object({
  zomato_item_id:   z.string().min(1, 'Zomato item ID is required'),
  zomato_item_name: z.string().max(255).optional(),
  menu_item_id:     z.string().uuid('Menu item ID must be a valid UUID'),
});

export type UpsertMappingRequest = z.infer<typeof UpsertMappingSchema>;
