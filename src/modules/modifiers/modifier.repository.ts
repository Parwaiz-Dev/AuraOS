import { query } from '@/config/database';
import {
  ModifierGroup,
  ModifierOption,
  MenuItemModifierGroup,
  OrderItemModifier,
} from './modifier.types';

export class ModifierRepository {
  // ── Modifier Groups ──────────────────────────────────────────────────────

  async createGroup(
    restaurantId: string,
    name: string,
    selectionType: 'single' | 'multiple',
    minSelect: number,
    maxSelect: number,
    sortOrder: number,
  ): Promise<ModifierGroup> {
    const result = await query(
      `INSERT INTO modifier_groups (restaurant_id, name, selection_type, min_select, max_select, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, restaurant_id, name, selection_type, min_select, max_select, sort_order, is_active, created_at, updated_at`,
      [restaurantId, name, selectionType, minSelect, maxSelect, sortOrder],
    );
    return result.rows[0];
  }

  async findGroupById(groupId: string): Promise<ModifierGroup | null> {
    const result = await query(
      `SELECT id, restaurant_id, name, selection_type, min_select, max_select, sort_order, is_active, created_at, updated_at
       FROM modifier_groups WHERE id = $1 LIMIT 1`,
      [groupId],
    );
    return result.rows[0] || null;
  }

  async findGroupsByRestaurantId(restaurantId: string): Promise<ModifierGroup[]> {
    const result = await query(
      `SELECT id, restaurant_id, name, selection_type, min_select, max_select, sort_order, is_active, created_at, updated_at
       FROM modifier_groups WHERE restaurant_id = $1 ORDER BY sort_order ASC, name ASC`,
      [restaurantId],
    );
    return result.rows;
  }

  async updateGroup(
    groupId: string,
    updates: Partial<{
      name: string;
      selection_type: 'single' | 'multiple';
      min_select: number;
      max_select: number;
      sort_order: number;
    }>,
  ): Promise<ModifierGroup | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.selection_type !== undefined) {
      fields.push(`selection_type = $${paramIndex++}`);
      values.push(updates.selection_type);
    }
    if (updates.min_select !== undefined) {
      fields.push(`min_select = $${paramIndex++}`);
      values.push(updates.min_select);
    }
    if (updates.max_select !== undefined) {
      fields.push(`max_select = $${paramIndex++}`);
      values.push(updates.max_select);
    }
    if (updates.sort_order !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(updates.sort_order);
    }

    if (fields.length === 0) {
      return this.findGroupById(groupId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(groupId);

    const result = await query(
      `UPDATE modifier_groups SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, restaurant_id, name, selection_type, min_select, max_select, sort_order, is_active, created_at, updated_at`,
      values,
    );
    return result.rows[0] || null;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const result = await query('DELETE FROM modifier_groups WHERE id = $1', [groupId]);
    return (result.rowCount ?? 0) > 0;
  }

  async groupNameExists(restaurantId: string, name: string, excludeId?: string): Promise<boolean> {
    let queryText = 'SELECT 1 FROM modifier_groups WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)';
    const params: any[] = [restaurantId, name];

    if (excludeId) {
      queryText += ' AND id != $3';
      params.push(excludeId);
    }

    queryText += ' LIMIT 1';
    const result = await query(queryText, params);
    return result.rows.length > 0;
  }

  // ── Modifier Options ─────────────────────────────────────────────────────

  async createOption(
    modifierGroupId: string,
    name: string,
    priceAdjustment: number,
    sortOrder: number,
  ): Promise<ModifierOption> {
    const result = await query(
      `INSERT INTO modifier_options (modifier_group_id, name, price_adjustment, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, modifier_group_id, name, price_adjustment, sort_order, is_active, created_at, updated_at`,
      [modifierGroupId, name, priceAdjustment, sortOrder],
    );
    return result.rows[0];
  }

  async findOptionById(optionId: string): Promise<ModifierOption | null> {
    const result = await query(
      `SELECT id, modifier_group_id, name, price_adjustment, sort_order, is_active, created_at, updated_at
       FROM modifier_options WHERE id = $1 LIMIT 1`,
      [optionId],
    );
    return result.rows[0] || null;
  }

  async findOptionsByGroupId(groupId: string): Promise<ModifierOption[]> {
    const result = await query(
      `SELECT id, modifier_group_id, name, price_adjustment, sort_order, is_active, created_at, updated_at
       FROM modifier_options WHERE modifier_group_id = $1 ORDER BY sort_order ASC, name ASC`,
      [groupId],
    );
    return result.rows;
  }

  async updateOption(
    optionId: string,
    updates: Partial<{
      name: string;
      price_adjustment: number;
      sort_order: number;
    }>,
  ): Promise<ModifierOption | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.price_adjustment !== undefined) {
      fields.push(`price_adjustment = $${paramIndex++}`);
      values.push(updates.price_adjustment);
    }
    if (updates.sort_order !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(updates.sort_order);
    }

    if (fields.length === 0) {
      return this.findOptionById(optionId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(optionId);

    const result = await query(
      `UPDATE modifier_options SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, modifier_group_id, name, price_adjustment, sort_order, is_active, created_at, updated_at`,
      values,
    );
    return result.rows[0] || null;
  }

  async deleteOption(optionId: string): Promise<boolean> {
    const result = await query('DELETE FROM modifier_options WHERE id = $1', [optionId]);
    return (result.rowCount ?? 0) > 0;
  }

  async optionNameExistsInGroup(groupId: string, name: string, excludeId?: string): Promise<boolean> {
    let queryText = 'SELECT 1 FROM modifier_options WHERE modifier_group_id = $1 AND LOWER(name) = LOWER($2)';
    const params: any[] = [groupId, name];

    if (excludeId) {
      queryText += ' AND id != $3';
      params.push(excludeId);
    }

    queryText += ' LIMIT 1';
    const result = await query(queryText, params);
    return result.rows.length > 0;
  }

  // ── Menu Item ↔ Modifier Group Junction ──────────────────────────────────

  async attachGroupToMenuItem(
    menuItemId: string,
    modifierGroupId: string,
    sortOrder: number,
  ): Promise<MenuItemModifierGroup> {
    const result = await query(
      `INSERT INTO menu_item_modifier_groups (menu_item_id, modifier_group_id, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (menu_item_id, modifier_group_id) DO UPDATE SET sort_order = $3
       RETURNING id, menu_item_id, modifier_group_id, sort_order, created_at`,
      [menuItemId, modifierGroupId, sortOrder],
    );
    return result.rows[0];
  }

  async detachGroupFromMenuItem(menuItemId: string, modifierGroupId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM menu_item_modifier_groups WHERE menu_item_id = $1 AND modifier_group_id = $2',
      [menuItemId, modifierGroupId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findModifierGroupsByMenuItem(menuItemId: string): Promise<ModifierGroup[]> {
    const result = await query(
      `SELECT mg.id, mg.restaurant_id, mg.name, mg.selection_type, mg.min_select, mg.max_select, mg.sort_order, mg.is_active, mg.created_at, mg.updated_at
       FROM modifier_groups mg
       INNER JOIN menu_item_modifier_groups mimg ON mimg.modifier_group_id = mg.id
       WHERE mimg.menu_item_id = $1
       ORDER BY mimg.sort_order ASC, mg.name ASC`,
      [menuItemId],
    );
    return result.rows;
  }

  async findAllModifierGroupsWithOptionsByMenuItem(menuItemId: string): Promise<ModifierGroup[]> {
    const groups = await this.findModifierGroupsByMenuItem(menuItemId);
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);
    const optionsResult = await query(
      `SELECT id, modifier_group_id, name, price_adjustment, sort_order, is_active, created_at, updated_at
       FROM modifier_options WHERE modifier_group_id = ANY($1::uuid[]) AND is_active = TRUE
       ORDER BY sort_order ASC, name ASC`,
      [groupIds],
    );

    const optionsByGroup: Record<string, ModifierOption[]> = {};
    for (const opt of optionsResult.rows) {
      if (!optionsByGroup[opt.modifier_group_id]) optionsByGroup[opt.modifier_group_id] = [];
      optionsByGroup[opt.modifier_group_id].push(opt);
    }

    return groups.map((g) => ({ ...g, options: optionsByGroup[g.id] || [] }));
  }

  async updateModifierGroupSortOrder(
    menuItemId: string,
    modifierGroupId: string,
    sortOrder: number,
  ): Promise<boolean> {
    const result = await query(
      `UPDATE menu_item_modifier_groups SET sort_order = $3
       WHERE menu_item_id = $1 AND modifier_group_id = $2`,
      [menuItemId, modifierGroupId, sortOrder],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Order Item Modifier Selections ───────────────────────────────────────

  async createOrderItemModifier(
    orderItemId: string,
    modifierGroupId: string,
    modifierGroupName: string,
    modifierOptionId: string,
    modifierOptionName: string,
    priceAdjustment: number,
  ): Promise<OrderItemModifier> {
    const result = await query(
      `INSERT INTO order_item_modifiers (order_item_id, modifier_group_id, modifier_group_name, modifier_option_id, modifier_option_name, price_adjustment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, order_item_id, modifier_group_id, modifier_group_name, modifier_option_id, modifier_option_name, price_adjustment, created_at`,
      [orderItemId, modifierGroupId, modifierGroupName, modifierOptionId, modifierOptionName, priceAdjustment],
    );
    return result.rows[0];
  }

  async findOrderItemModifiers(orderItemId: string): Promise<OrderItemModifier[]> {
    const result = await query(
      `SELECT id, order_item_id, modifier_group_id, modifier_group_name, modifier_option_id, modifier_option_name, price_adjustment, created_at
       FROM order_item_modifiers WHERE order_item_id = $1
       ORDER BY created_at ASC`,
      [orderItemId],
    );
    return result.rows;
  }
}

export const modifierRepository = new ModifierRepository();