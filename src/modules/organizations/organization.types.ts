/**
 * Organization types & validation schemas for Multi-Outlet support.
 *
 * organization_groups — named groups owned by a platform super-admin.
 * organization_group_restaurants — many-to-many linking restaurants into groups.
 */

import { z } from 'zod';

// ── Database Row Types ─────────────────────────────────────────────────────────

export interface OrganizationGroup {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationGroupRestaurant {
  organization_group_id: string;
  restaurant_id: string;
  added_at: string;
}

// ── Enriched types (with joins) ───────────────────────────────────────────────

export interface OrganizationGroupWithRestaurants extends OrganizationGroup {
  restaurants: OrganizationGroupRestaurantDetail[];
}

export interface OrganizationGroupRestaurantDetail {
  id: string;
  name: string;
  slug: string;
  restaurant_type: string;
  added_at: string;
}

// ── Request Validation Schemas ─────────────────────────────────────────────────

export const CreateOrganizationGroupSchema = z.object({
  name: z.string().min(2).max(100),
});

export const AddRestaurantToGroupSchema = z.object({
  restaurant_id: z.string().uuid(),
});

export const UpdateOrganizationGroupSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

// ── Response Types ─────────────────────────────────────────────────────────────

export interface AggregateMetrics {
  total_revenue: number;
  total_orders: number;
  active_outlets: number;
  outlets: OutletMetric[];
}

export interface OutletMetric {
  id: string;
  name: string;
  slug: string;
  revenue: number;
  orders: number;
}