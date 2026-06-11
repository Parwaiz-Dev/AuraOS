import { pool, query } from '@/config/database';
import {
  OrganizationGroup,
  OrganizationGroupWithRestaurants,
  OrganizationGroupRestaurantDetail,
  AggregateMetrics,
  OutletMetric,
} from './organization.types';

export class OrganizationRepository {
  // ── Organization Groups ─────────────────────────────────────────────────────

  async createGroup(name: string, ownerUserId: string): Promise<OrganizationGroup> {
    const result = await query(
      `INSERT INTO organization_groups (name, owner_user_id) VALUES ($1, $2)
       RETURNING id, name, owner_user_id, created_at, updated_at`,
      [name, ownerUserId],
    );
    return result.rows[0];
  }

  async findGroupById(groupId: string): Promise<OrganizationGroup | null> {
    const result = await query(
      `SELECT id, name, owner_user_id, created_at, updated_at
       FROM organization_groups WHERE id = $1`,
      [groupId],
    );
    return result.rows[0] || null;
  }

  async findGroupsByOwner(ownerUserId: string): Promise<OrganizationGroup[]> {
    const result = await query(
      `SELECT id, name, owner_user_id, created_at, updated_at
       FROM organization_groups WHERE owner_user_id = $1 ORDER BY created_at DESC`,
      [ownerUserId],
    );
    return result.rows;
  }

  async updateGroup(groupId: string, name: string): Promise<OrganizationGroup | null> {
    const result = await query(
      `UPDATE organization_groups SET name = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, name, owner_user_id, created_at, updated_at`,
      [name, groupId],
    );
    return result.rows[0] || null;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM organization_groups WHERE id = $1`,
      [groupId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Group ↔ Restaurant junction ─────────────────────────────────────────────

  async addRestaurantToGroup(groupId: string, restaurantId: string): Promise<void> {
    await query(
      `INSERT INTO organization_group_restaurants (organization_group_id, restaurant_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [groupId, restaurantId],
    );
  }

  async removeRestaurantFromGroup(groupId: string, restaurantId: string): Promise<void> {
    await query(
      `DELETE FROM organization_group_restaurants
       WHERE organization_group_id = $1 AND restaurant_id = $2`,
      [groupId, restaurantId],
    );
  }

  async findGroupRestaurants(groupId: string): Promise<OrganizationGroupRestaurantDetail[]> {
    const result = await query(
      `SELECT r.id, r.name, r.slug, r.restaurant_type, ogr.added_at
       FROM organization_group_restaurants ogr
       JOIN restaurants r ON r.id = ogr.restaurant_id
       WHERE ogr.organization_group_id = $1
       ORDER BY ogr.added_at`,
      [groupId],
    );
    return result.rows;
  }

  async findGroupWithRestaurants(groupId: string): Promise<OrganizationGroupWithRestaurants | null> {
    const group = await this.findGroupById(groupId);
    if (!group) return null;
    const restaurants = await this.findGroupRestaurants(groupId);
    return { ...group, restaurants };
  }

  async isRestaurantInGroup(groupId: string, restaurantId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM organization_group_restaurants
       WHERE organization_group_id = $1 AND restaurant_id = $2`,
      [groupId, restaurantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isGroupOwnedByUser(groupId: string, userId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM organization_groups WHERE id = $1 AND owner_user_id = $2`,
      [groupId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Aggregated metrics ──────────────────────────────────────────────────────

  async getAggregateMetrics(groupId: string): Promise<AggregateMetrics> {
    // Get all restaurant IDs in the group
    const restaurants = await this.findGroupRestaurants(groupId);
    const restaurantIds = restaurants.map((r) => r.id);

    if (restaurantIds.length === 0) {
      return { total_revenue: 0, total_orders: 0, active_outlets: 0, outlets: [] };
    }

    // Aggregate orders data across all restaurants using a single query
    const placeholders = restaurantIds.map((_, i) => `$${i + 1}`).join(', ');
    const statsResult = await query(
      `SELECT
         COALESCE(SUM(total_amount), 0)::numeric as total_revenue,
         COALESCE(COUNT(*), 0)::bigint as total_orders
       FROM orders
       WHERE restaurant_id IN (${placeholders})
         AND status IN ('PAYMENT_PENDING', 'COMPLETED')`,
      restaurantIds,
    );
    const { total_revenue, total_orders } = statsResult.rows[0];

    // Per-outlet stats
    const outletResult = await query(
      `SELECT
         r.id, r.name, r.slug,
         COALESCE(SUM(o.total_amount), 0)::numeric as revenue,
         COALESCE(COUNT(o.id), 0)::bigint as orders
       FROM restaurants r
       LEFT JOIN orders o ON o.restaurant_id = r.id
         AND o.status IN ('PAYMENT_PENDING', 'COMPLETED')
       WHERE r.id IN (${placeholders})
       GROUP BY r.id, r.name, r.slug
       ORDER BY revenue DESC`,
      restaurantIds,
    );

    const outlets: OutletMetric[] = outletResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders, 10) || 0,
    }));

    return {
      total_revenue: parseFloat(total_revenue) || 0,
      total_orders: parseInt(total_orders, 10) || 0,
      active_outlets: outlets.length,
      outlets,
    };
  }

  // ── List all restaurants (for dropdown picking) ──────────────────────────────

  async findAllRestaurants(): Promise<{ id: string; name: string; slug: string; restaurant_type: string }[]> {
    const result = await pool.query(
      `SELECT id, name, slug, restaurant_type FROM restaurants ORDER BY name`,
    );
    return result.rows;
  }

  // ── User-accessible restaurants (via organization groups) ────────────────────

  /**
   * Returns all restaurants that belong to any organization group owned by the user.
   * Used by the restaurant switcher to list only restaurants the super-admin controls.
   */
  async findUserAccessibleRestaurants(
    userId: string,
  ): Promise<{ id: string; name: string; slug: string; restaurant_type: string }[]> {
    const result = await query(
      `SELECT DISTINCT r.id, r.name, r.slug, r.restaurant_type
       FROM restaurants r
       JOIN organization_group_restaurants ogr ON ogr.restaurant_id = r.id
       JOIN organization_groups og ON og.id = ogr.organization_group_id
       WHERE og.owner_user_id = $1
       ORDER BY r.name`,
      [userId],
    );
    return result.rows;
  }
}

export const organizationRepository = new OrganizationRepository();