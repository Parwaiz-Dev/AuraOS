import { z } from 'zod';

export const CreateMenuCategoryRequestSchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(255, 'Category name must be less than 255 characters'),
  description: z.string().max(1000).optional(),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const UpdateMenuCategoryRequestSchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(255, 'Category name must be less than 255 characters').optional(),
  description: z.string().max(1000).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const CreateMenuItemRequestSchema = z.object({
  category_id: z.string().uuid('Category ID must be a valid UUID'),
  name: z.string().min(2, 'Menu item name must be at least 2 characters').max(255, 'Menu item name must be less than 255 characters'),
  description: z.string().max(1000).optional(),
  price: z.number().positive('Price must be greater than 0'),
  prep_time_minutes: z.number().int().min(1, 'Prep time must be at least 1 minute'),
  is_vegetarian: z.boolean().default(false),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
});

export const UpdateMenuItemRequestSchema = z.object({
  category_id: z.string().uuid('Category ID must be a valid UUID').optional(),
  name: z.string().min(2, 'Menu item name must be at least 2 characters').max(255, 'Menu item name must be less than 255 characters').optional(),
  description: z.string().max(1000).optional(),
  price: z.number().positive('Price must be greater than 0').optional(),
  prep_time_minutes: z.number().int().min(1, 'Prep time must be at least 1 minute').optional(),
  is_vegetarian: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
});

export type CreateMenuCategoryRequest = z.infer<typeof CreateMenuCategoryRequestSchema>;
export type UpdateMenuCategoryRequest = z.infer<typeof UpdateMenuCategoryRequestSchema>;
export type CreateMenuItemRequest = z.infer<typeof CreateMenuItemRequestSchema>;
export type UpdateMenuItemRequest = z.infer<typeof UpdateMenuItemRequestSchema>;

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  prep_time_minutes: number;
  is_vegetarian: boolean;
  is_active: boolean;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface MenuStats {
  total_categories: number;
  active_categories: number;
  total_items: number;
  active_items: number;
}
