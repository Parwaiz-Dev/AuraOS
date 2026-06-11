import { z } from 'zod';

export type RestaurantType =
  | 'FULL_SERVICE'
  | 'QSR_SIMPLE'
  | 'QSR_CHAIN'
  | 'CAFE'
  | 'CLOUD_KITCHEN'
  | 'HYBRID';

export const CreateRestaurantRequestSchema = z.object({
  name: z.string().min(2).max(255),
  auto_approve_online_orders: z.boolean().default(false),
  delay_threshold_minutes: z.number().int().min(1).max(120).default(15),
});

export const UpdateRestaurantRequestSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  auto_approve_online_orders: z.boolean().optional(),
  delay_threshold_minutes: z.number().int().min(1).max(120).optional(),
  qr_mode: z.enum(['restaurant', 'mall']).optional(),
  gstin: z.string().max(15).nullable().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  tax_inclusive: z.boolean().optional(),
  restaurant_type: z.enum(['FULL_SERVICE','QSR_SIMPLE','QSR_CHAIN','CAFE','CLOUD_KITCHEN','HYBRID']).optional(),
  qsr_enabled: z.boolean().optional(),
  token_prefix: z.string().max(10).optional(),
  token_daily_reset: z.boolean().optional(),
  features: z.object({
    kitchen_display: z.boolean().optional(),
    inventory:       z.boolean().optional(),
    reports:         z.boolean().optional(),
    qr_ordering:     z.boolean().optional(),
    whatsapp:        z.boolean().optional(),
    zomato:          z.boolean().optional(),
    payments:        z.boolean().optional(),
    waiter_app:      z.boolean().optional(),
  }).optional(),
});

export type CreateRestaurantRequest = z.infer<typeof CreateRestaurantRequestSchema>;
export type UpdateRestaurantRequest = z.infer<typeof UpdateRestaurantRequestSchema>;

export interface RestaurantFeatures {
  kitchen_display: boolean;
  inventory: boolean;
  reports: boolean;
  qr_ordering: boolean;
  whatsapp: boolean;
  zomato: boolean;
  payments: boolean;
  waiter_app: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  auto_approve_online_orders: boolean;
  delay_threshold_minutes: number;
  qr_mode: 'restaurant' | 'mall';
  features: RestaurantFeatures;
  gstin: string | null;
  tax_rate: number;
  tax_inclusive: boolean;
  restaurant_type: RestaurantType;
  qsr_enabled: boolean;
  token_prefix: string;
  token_daily_reset: boolean;
  token_counter: number;
  created_at: Date;
  updated_at: Date;
}

export interface RestaurantSection {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RestaurantStats {
  total_users: number;
  active_users: number;
  total_tables: number;
  active_tables: number;
  total_orders_today: number;
  revenue_today: number;
}

export interface RestaurantWithStats extends Restaurant {
  stats?: RestaurantStats;
}