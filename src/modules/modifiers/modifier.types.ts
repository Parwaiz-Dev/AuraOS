import { z } from 'zod';

// ── Modifier Group Schemas ──────────────────────────────────────────────────

export const CreateModifierGroupRequestSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(255, 'Group name must be less than 255 characters'),
  selection_type: z.enum(['single', 'multiple']).default('single'),
  min_select: z.number().int().min(0).default(0),
  max_select: z.number().int().min(1).default(1),
  sort_order: z.number().int().min(0).default(0),
  options: z.array(z.object({
    name: z.string().min(1, 'Option name is required').max(255),
    price_adjustment: z.number().default(0),
    sort_order: z.number().int().min(0).default(0),
  })).optional(),
});

export const UpdateModifierGroupRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  selection_type: z.enum(['single', 'multiple']).optional(),
  min_select: z.number().int().min(0).optional(),
  max_select: z.number().int().min(1).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ── Modifier Option Schemas ─────────────────────────────────────────────────

export const CreateModifierOptionRequestSchema = z.object({
  name: z.string().min(1, 'Option name is required').max(255),
  price_adjustment: z.number().default(0),
  sort_order: z.number().int().min(0).default(0),
});

export const UpdateModifierOptionRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  price_adjustment: z.number().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ── Attach modifier groups to menu items ────────────────────────────────────

export const AttachModifierGroupsRequestSchema = z.object({
  modifier_group_ids: z.array(z.string().uuid('Invalid modifier group ID')),
});

// ── Reorder modifier groups on a menu item ──────────────────────────────────

export const ReorderModifierGroupsRequestSchema = z.object({
  items: z.array(z.object({
    modifier_group_id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type CreateModifierGroupRequest = z.infer<typeof CreateModifierGroupRequestSchema>;
export type UpdateModifierGroupRequest = z.infer<typeof UpdateModifierGroupRequestSchema>;
export type CreateModifierOptionRequest = z.infer<typeof CreateModifierOptionRequestSchema>;
export type UpdateModifierOptionRequest = z.infer<typeof UpdateModifierOptionRequestSchema>;
export type AttachModifierGroupsRequest = z.infer<typeof AttachModifierGroupsRequestSchema>;
export type ReorderModifierGroupsRequest = z.infer<typeof ReorderModifierGroupsRequestSchema>;

// ── DB Row Interfaces ───────────────────────────────────────────────────────

export interface ModifierGroup {
  id: string;
  restaurant_id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  min_select: number;
  max_select: number;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // populated from JOIN when fetching
  options?: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  modifier_group_id: string;
  name: string;
  price_adjustment: number;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MenuItemModifierGroup {
  id: string;
  menu_item_id: string;
  modifier_group_id: string;
  sort_order: number;
  created_at: Date;
}

export interface OrderItemModifier {
  id: string;
  order_item_id: string;
  modifier_group_id: string;
  modifier_group_name: string;
  modifier_option_id: string;
  modifier_option_name: string;
  price_adjustment: number;
  created_at: Date;
}