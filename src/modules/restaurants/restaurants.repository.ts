import { query } from '@/config/database';
import { Restaurant, RestaurantSection, RestaurantStats } from './restaurants.types';

const RESTAURANT_COLS = `id, name, slug, auto_approve_online_orders, delay_threshold_minutes,
  qr_mode, features, gstin, tax_rate::float8 AS tax_rate, tax_inclusive,
  restaurant_type, qsr_enabled, token_prefix, token_daily_reset, token_counter,
  created_at, updated_at`;

export class RestaurantsRepository {
  async create(
    name: string,
    slug: string,
    autoApproveOnlineOrders: boolean = false,
    delayThresholdMinutes: number = 15,
  ): Promise<Restaurant> {
    const result = await query(
      `INSERT INTO restaurants (name, slug, auto_approve_online_orders, delay_threshold_minutes)
       VALUES ($1, $2, $3, $4)
       RETURNING ${RESTAURANT_COLS}`,
      [name, slug, autoApproveOnlineOrders, delayThresholdMinutes],
    );
    return result.rows[0];
  }

  async findById(restaurantId: string): Promise<Restaurant | null> {
    const result = await query(
      `SELECT ${RESTAURANT_COLS} FROM restaurants WHERE id = $1 LIMIT 1`,
      [restaurantId],
    );
    return result.rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const result = await query(
      `SELECT ${RESTAURANT_COLS} FROM restaurants WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    return result.rows[0] || null;
  }

  async update(
    restaurantId: string,
    updates: Partial<{
      name: string;
      slug: string;
      auto_approve_online_orders: boolean;
      delay_threshold_minutes: number;
      qr_mode: string;
      features: Record<string, boolean>;
      gstin: string | null;
      tax_rate: number;
      tax_inclusive: boolean;
      restaurant_type: string;
      qsr_enabled: boolean;
      token_prefix: string;
      token_daily_reset: boolean;
    }>,
  ): Promise<Restaurant | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name); }
    if (updates.slug !== undefined) { fields.push(`slug = $${paramIndex++}`); values.push(updates.slug); }
    if (updates.auto_approve_online_orders !== undefined) { fields.push(`auto_approve_online_orders = $${paramIndex++}`); values.push(updates.auto_approve_online_orders); }
    if (updates.delay_threshold_minutes !== undefined) { fields.push(`delay_threshold_minutes = $${paramIndex++}`); values.push(updates.delay_threshold_minutes); }
    if (updates.qr_mode !== undefined) { fields.push(`qr_mode = $${paramIndex++}`); values.push(updates.qr_mode); }
    if (updates.features !== undefined) { fields.push(`features = features || $${paramIndex++}::jsonb`); values.push(JSON.stringify(updates.features)); }
    if (updates.gstin !== undefined) { fields.push(`gstin = $${paramIndex++}`); values.push(updates.gstin); }
    if (updates.tax_rate !== undefined) { fields.push(`tax_rate = $${paramIndex++}`); values.push(updates.tax_rate); }
    if (updates.tax_inclusive !== undefined) { fields.push(`tax_inclusive = $${paramIndex++}`); values.push(updates.tax_inclusive); }
    if (updates.restaurant_type !== undefined) { fields.push(`restaurant_type = $${paramIndex++}`); values.push(updates.restaurant_type); }
    if (updates.qsr_enabled !== undefined) { fields.push(`qsr_enabled = $${paramIndex++}`); values.push(updates.qsr_enabled); }
    if (updates.token_prefix !== undefined) { fields.push(`token_prefix = $${paramIndex++}`); values.push(updates.token_prefix); }
    if (updates.token_daily_reset !== undefined) { fields.push(`token_daily_reset = $${paramIndex++}`); values.push(updates.token_daily_reset); }

    if (fields.length === 0) return this.findById(restaurantId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(restaurantId);

    const result = await query(
      `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING ${RESTAURANT_COLS}`,
      values,
    );
    return result.rows[0] || null;
  }

  /**
   * Atomically increment and return the next token number for a restaurant.
   * Resets the counter to 1 if token_daily_reset is true and the last reset
   * was not today. Returns the new counter value.
   */
  async nextTokenNumber(restaurantId: string): Promise<number> {
    const result = await query(
      `UPDATE restaurants
       SET
         token_counter = CASE
           WHEN token_daily_reset AND (token_last_reset_at IS NULL OR token_last_reset_at < CURRENT_DATE)
           THEN 1
           ELSE token_counter + 1
         END,
         token_last_reset_at = CASE
           WHEN token_daily_reset AND (token_last_reset_at IS NULL OR token_last_reset_at < CURRENT_DATE)
           THEN CURRENT_DATE
           ELSE token_last_reset_at
         END
       WHERE id = $1
       RETURNING token_counter`,
      [restaurantId],
    );
    return result.rows[0].token_counter as number;
  }

  async delete(restaurantId: string): Promise<boolean> {
    const result = await query('DELETE FROM restaurants WHERE id = $1', [restaurantId]);
    return (result.rowCount ?? 0) > 0;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let queryText = 'SELECT 1 FROM restaurants WHERE slug = $1';
    const params: any[] = [slug];
    if (excludeId) { queryText += ' AND id != $2'; params.push(excludeId); }
    queryText += ' LIMIT 1';
    const result = await query(queryText, params);
    return result.rows.length > 0;
  }

  async getStats(restaurantId: string): Promise<RestaurantStats> {
    const usersResult = await query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN is_active = true THEN 1 END) as active FROM users WHERE restaurant_id = $1',
      [restaurantId],
    );
    const tablesResult = await query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN is_active = true THEN 1 END) as active FROM restaurant_tables WHERE restaurant_id = $1',
      [restaurantId],
    );
    const ordersResult = await query(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as revenue
       FROM orders WHERE restaurant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
      [restaurantId],
    );
    const users = usersResult.rows[0];
    const tables = tablesResult.rows[0];
    const orders = ordersResult.rows[0] || { total_orders: 0, revenue: 0 };
    return {
      total_users: parseInt(users.total) || 0,
      active_users: parseInt(users.active) || 0,
      total_tables: parseInt(tables.total) || 0,
      active_tables: parseInt(tables.active) || 0,
      total_orders_today: parseInt(orders.total_orders) || 0,
      revenue_today: parseFloat(orders.revenue) || 0,
    };
  }

  async findAll(limit: number = 50, offset: number = 0): Promise<Restaurant[]> {
    const result = await query(
      `SELECT ${RESTAURANT_COLS} FROM restaurants ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  async count(): Promise<number> {
    const result = await query('SELECT COUNT(*) as count FROM restaurants');
    return parseInt(result.rows[0].count) || 0;
  }

  // ── Sections ────────────────────────────────────────────────────────────────

  async findSectionsByRestaurantId(restaurantId: string): Promise<RestaurantSection[]> {
    const result = await query(
      `SELECT id, restaurant_id, name, display_order, is_active, created_at, updated_at
       FROM restaurant_sections
       WHERE restaurant_id = $1
       ORDER BY display_order ASC, name ASC`,
      [restaurantId],
    );
    return result.rows;
  }

  async createSection(restaurantId: string, name: string, displayOrder: number): Promise<RestaurantSection> {
    const result = await query(
      `INSERT INTO restaurant_sections (restaurant_id, name, display_order)
       VALUES ($1, $2, $3)
       RETURNING id, restaurant_id, name, display_order, is_active, created_at, updated_at`,
      [restaurantId, name, displayOrder],
    );
    return result.rows[0];
  }

  async updateSection(
    sectionId: string,
    restaurantId: string,
    updates: Partial<{ name: string; display_order: number; is_active: boolean }>,
  ): Promise<RestaurantSection | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name); }
    if (updates.display_order !== undefined) { fields.push(`display_order = $${i++}`); values.push(updates.display_order); }
    if (updates.is_active !== undefined) { fields.push(`is_active = $${i++}`); values.push(updates.is_active); }
    if (fields.length === 0) return null;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(sectionId, restaurantId);
    const result = await query(
      `UPDATE restaurant_sections SET ${fields.join(', ')}
       WHERE id = $${i} AND restaurant_id = $${i + 1}
       RETURNING id, restaurant_id, name, display_order, is_active, created_at, updated_at`,
      values,
    );
    return result.rows[0] || null;
  }

  async deleteSection(sectionId: string, restaurantId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM restaurant_sections WHERE id = $1 AND restaurant_id = $2',
      [sectionId, restaurantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async assignCategoryToSection(categoryId: string, sectionId: string | null, restaurantId: string): Promise<void> {
    await query(
      `UPDATE menu_categories SET section_id = $1
       WHERE id = $2 AND restaurant_id = $3`,
      [sectionId, categoryId, restaurantId],
    );
  }
}

export const restaurantsRepository = new RestaurantsRepository();
