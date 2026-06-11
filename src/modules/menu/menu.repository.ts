import { query } from '@/config/database';
import { MenuCategory, MenuItem, MenuStats } from './menu.types';

export class MenuRepository {
  async createCategory(
    restaurantId: string,
    name: string,
    description: string | null,
    displayOrder: number,
    isActive: boolean
  ): Promise<MenuCategory> {
    const result = await query(
      `INSERT INTO menu_categories (restaurant_id, name, description, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, restaurant_id, name, description, display_order, is_active, created_at, updated_at`,
      [restaurantId, name, description, displayOrder, isActive]
    );
    return result.rows[0];
  }

  async findCategoryById(categoryId: string): Promise<MenuCategory | null> {
    const result = await query(
      'SELECT id, restaurant_id, name, description, display_order, is_active, created_at, updated_at FROM menu_categories WHERE id = $1 LIMIT 1',
      [categoryId]
    );
    return result.rows[0] || null;
  }

  async findCategoriesByRestaurantId(restaurantId: string): Promise<MenuCategory[]> {
    const result = await query(
      'SELECT id, restaurant_id, name, description, display_order, is_active, created_at, updated_at FROM menu_categories WHERE restaurant_id = $1 ORDER BY display_order ASC, name ASC',
      [restaurantId]
    );
    return result.rows;
  }

  async updateCategory(
    categoryId: string,
    updates: Partial<{
      name: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
    }>
  ): Promise<MenuCategory | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.display_order !== undefined) {
      fields.push(`display_order = $${paramIndex++}`);
      values.push(updates.display_order);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return this.findCategoryById(categoryId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(categoryId);

    const result = await query(
      `UPDATE menu_categories SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, restaurant_id, name, description, display_order, is_active, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    const result = await query('DELETE FROM menu_categories WHERE id = $1', [categoryId]);
    return (result.rowCount ?? 0) > 0;
  }

  async categoryNameExists(restaurantId: string, name: string, excludeId?: string): Promise<boolean> {
    let queryText = 'SELECT 1 FROM menu_categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)';
    const params: any[] = [restaurantId, name];

    if (excludeId) {
      queryText += ' AND id != $3';
      params.push(excludeId);
    }

    queryText += ' LIMIT 1';
    const result = await query(queryText, params);
    return result.rows.length > 0;
  }

  async createMenuItem(
    restaurantId: string,
    categoryId: string,
    name: string,
    description: string | null,
    price: number,
    prepTimeMinutes: number,
    isVegetarian: boolean,
    isActive: boolean,
    displayOrder: number
  ): Promise<MenuItem> {
    const result = await query(
      `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order, created_at, updated_at`,
      [restaurantId, categoryId, name, description, price, prepTimeMinutes, isVegetarian, isActive, displayOrder]
    );
    return result.rows[0];
  }

  async findMenuItemById(menuItemId: string): Promise<MenuItem | null> {
    const result = await query(
      'SELECT id, restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order, created_at, updated_at FROM menu_items WHERE id = $1 LIMIT 1',
      [menuItemId]
    );
    return result.rows[0] || null;
  }

  async findMenuItemsByRestaurantId(restaurantId: string): Promise<MenuItem[]> {
    const result = await query(
      'SELECT id, restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order, created_at, updated_at FROM menu_items WHERE restaurant_id = $1 ORDER BY display_order ASC, name ASC',
      [restaurantId]
    );
    return result.rows;
  }

  async findMenuItemsByCategoryId(categoryId: string): Promise<MenuItem[]> {
    const result = await query(
      'SELECT id, restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order, created_at, updated_at FROM menu_items WHERE category_id = $1 ORDER BY display_order ASC, name ASC',
      [categoryId]
    );
    return result.rows;
  }

  async updateMenuItem(
    menuItemId: string,
    updates: Partial<{
      category_id: string;
      name: string;
      description: string | null;
      price: number;
      prep_time_minutes: number;
      is_vegetarian: boolean;
      is_active: boolean;
      display_order: number;
    }>
  ): Promise<MenuItem | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.category_id !== undefined) {
      fields.push(`category_id = $${paramIndex++}`);
      values.push(updates.category_id);
    }
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.price !== undefined) {
      fields.push(`price = $${paramIndex++}`);
      values.push(updates.price);
    }
    if (updates.prep_time_minutes !== undefined) {
      fields.push(`prep_time_minutes = $${paramIndex++}`);
      values.push(updates.prep_time_minutes);
    }
    if (updates.is_vegetarian !== undefined) {
      fields.push(`is_vegetarian = $${paramIndex++}`);
      values.push(updates.is_vegetarian);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }
    if (updates.display_order !== undefined) {
      fields.push(`display_order = $${paramIndex++}`);
      values.push(updates.display_order);
    }

    if (fields.length === 0) {
      return this.findMenuItemById(menuItemId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(menuItemId);

    const result = await query(
      `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  async deleteMenuItem(menuItemId: string): Promise<boolean> {
    const result = await query('DELETE FROM menu_items WHERE id = $1', [menuItemId]);
    return (result.rowCount ?? 0) > 0;
  }

  async menuItemNameExists(restaurantId: string, name: string, excludeId?: string): Promise<boolean> {
    let queryText = 'SELECT 1 FROM menu_items WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)';
    const params: any[] = [restaurantId, name];

    if (excludeId) {
      queryText += ' AND id != $3';
      params.push(excludeId);
    }

    queryText += ' LIMIT 1';
    const result = await query(queryText, params);
    return result.rows.length > 0;
  }

  async getMenuStats(restaurantId: string): Promise<MenuStats> {
    const result = await query(
      `SELECT
        COUNT(DISTINCT c.id) as total_categories,
        COUNT(DISTINCT CASE WHEN c.is_active THEN c.id END) as active_categories,
        COUNT(DISTINCT i.id) as total_items,
        COUNT(DISTINCT CASE WHEN i.is_active THEN i.id END) as active_items
       FROM menu_categories c
       LEFT JOIN menu_items i ON i.category_id = c.id
       WHERE c.restaurant_id = $1`,
      [restaurantId]
    );

    const stats = result.rows[0];
    return {
      total_categories: parseInt(stats.total_categories) || 0,
      active_categories: parseInt(stats.active_categories) || 0,
      total_items: parseInt(stats.total_items) || 0,
      active_items: parseInt(stats.active_items) || 0,
    };
  }
}

export const menuRepository = new MenuRepository();