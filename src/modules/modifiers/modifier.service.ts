import { modifierRepository } from './modifier.repository';
import {
  ModifierGroup,
  ModifierOption,
  CreateModifierGroupRequest,
  UpdateModifierGroupRequest,
  CreateModifierOptionRequest,
  UpdateModifierOptionRequest,
} from './modifier.types';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';

export class ModifierService {
  validateName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 255) {
      throw new BadRequestError('Name must be between 1 and 255 characters');
    }
    return trimmed;
  }

  // ── Modifier Groups ──────────────────────────────────────────────────────

  async createGroup(restaurantId: string, payload: CreateModifierGroupRequest): Promise<ModifierGroup> {
    const { name, selection_type, min_select, max_select, sort_order, options } = payload;
    const validatedName = this.validateName(name);

    if (await modifierRepository.groupNameExists(restaurantId, validatedName)) {
      throw new ConflictError('Modifier group name already exists for this restaurant');
    }

    const group = await modifierRepository.createGroup(
      restaurantId,
      validatedName,
      selection_type,
      min_select,
      max_select,
      sort_order,
    );

    // If options provided, create them
    if (options && options.length > 0) {
      const createdOptions: ModifierOption[] = [];
      for (const opt of options) {
        const validatedOptName = this.validateName(opt.name);
        const option = await modifierRepository.createOption(
          group.id,
          validatedOptName,
          opt.price_adjustment,
          opt.sort_order,
        );
        createdOptions.push(option);
      }
      group.options = createdOptions;
    }

    return group;
  }

  async getGroup(groupId: string): Promise<ModifierGroup> {
    const group = await modifierRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError('Modifier group not found');
    }
    // Always include options
    group.options = await modifierRepository.findOptionsByGroupId(groupId);
    return group;
  }

  async getGroups(restaurantId: string): Promise<ModifierGroup[]> {
    const groups = await modifierRepository.findGroupsByRestaurantId(restaurantId);
    // Batch-fetch options for all groups
    if (groups.length > 0) {
      const allOptions = await Promise.all(
        groups.map((g) => modifierRepository.findOptionsByGroupId(g.id)),
      );
      groups.forEach((g, i) => {
        g.options = allOptions[i];
      });
    }
    return groups;
  }

  async updateGroup(
    groupId: string,
    restaurantId: string,
    payload: UpdateModifierGroupRequest,
  ): Promise<ModifierGroup> {
    const existing = await this.getGroup(groupId);
    if (existing.restaurant_id !== restaurantId) {
      throw new NotFoundError('Modifier group not found');
    }

    const updates: any = {};
    if (payload.name !== undefined) {
      const validatedName = this.validateName(payload.name);
      if (validatedName !== existing.name && await modifierRepository.groupNameExists(restaurantId, validatedName, groupId)) {
        throw new ConflictError('Modifier group name already exists for this restaurant');
      }
      updates.name = validatedName;
    }
    if (payload.selection_type !== undefined) updates.selection_type = payload.selection_type;
    if (payload.min_select !== undefined) updates.min_select = payload.min_select;
    if (payload.max_select !== undefined) updates.max_select = payload.max_select;
    if (payload.sort_order !== undefined) updates.sort_order = payload.sort_order;

    const updated = await modifierRepository.updateGroup(groupId, updates);
    if (!updated) {
      throw new NotFoundError('Modifier group not found');
    }
    return updated;
  }

  async deleteGroup(groupId: string, restaurantId: string): Promise<void> {
    const group = await this.getGroup(groupId);
    if (group.restaurant_id !== restaurantId) {
      throw new NotFoundError('Modifier group not found');
    }

    const deleted = await modifierRepository.deleteGroup(groupId);
    if (!deleted) {
      throw new NotFoundError('Modifier group not found');
    }
  }

  // ── Modifier Options ─────────────────────────────────────────────────────

  async createOption(
    groupId: string,
    restaurantId: string,
    payload: CreateModifierOptionRequest,
  ): Promise<ModifierOption> {
    const group = await this.getGroup(groupId);
    if (group.restaurant_id !== restaurantId) {
      throw new NotFoundError('Modifier group not found');
    }

    const validatedName = this.validateName(payload.name);
    if (await modifierRepository.optionNameExistsInGroup(groupId, validatedName)) {
      throw new ConflictError('Option name already exists in this modifier group');
    }

    return modifierRepository.createOption(
      groupId,
      validatedName,
      payload.price_adjustment,
      payload.sort_order,
    );
  }

  async getOptions(groupId: string, restaurantId: string): Promise<ModifierOption[]> {
    const group = await this.getGroup(groupId);
    if (group.restaurant_id !== restaurantId) {
      throw new NotFoundError('Modifier group not found');
    }
    return modifierRepository.findOptionsByGroupId(groupId);
  }

  async updateOption(
    optionId: string,
    restaurantId: string,
    payload: UpdateModifierOptionRequest,
  ): Promise<ModifierOption> {
    const option = await modifierRepository.findOptionById(optionId);
    if (!option) {
      throw new NotFoundError('Modifier option not found');
    }

    // Verify tenant isolation through parent group
    const group = await this.getGroup(option.modifier_group_id);
    if (group.restaurant_id !== restaurantId) {
      throw new NotFoundError('Modifier option not found');
    }

    const updates: any = {};
    if (payload.name !== undefined) {
      const validatedName = this.validateName(payload.name);
      if (validatedName !== option.name && await modifierRepository.optionNameExistsInGroup(option.modifier_group_id, validatedName, optionId)) {
        throw new ConflictError('Option name already exists in this modifier group');
      }
      updates.name = validatedName;
    }
    if (payload.price_adjustment !== undefined) updates.price_adjustment = payload.price_adjustment;
    if (payload.sort_order !== undefined) updates.sort_order = payload.sort_order;

    const updated = await modifierRepository.updateOption(optionId, updates);
    if (!updated) {
      throw new NotFoundError('Modifier option not found');
    }
    return updated;
  }

  async deleteOption(optionId: string, restaurantId: string): Promise<void> {
    const option = await modifierRepository.findOptionById(optionId);
    if (!option) {
      throw new NotFoundError('Modifier option not found');
    }

    const group = await this.getGroup(option.modifier_group_id);
    if (group.restaurant_id !== restaurantId) {
      throw new NotFoundError('Modifier option not found');
    }

    const deleted = await modifierRepository.deleteOption(optionId);
    if (!deleted) {
      throw new NotFoundError('Modifier option not found');
    }
  }

  // ── Menu Item ↔ Modifier Group ───────────────────────────────────────────

  async attachGroupsToMenuItem(
    menuItemId: string,
    modifierGroupIds: string[],
    restaurantId: string,
  ): Promise<ModifierGroup[]> {
    // Verify all groups belong to this restaurant
    for (const groupId of modifierGroupIds) {
      const group = await this.getGroup(groupId);
      if (group.restaurant_id !== restaurantId) {
        throw new NotFoundError(`Modifier group ${groupId} not found`);
      }
    }

    for (let i = 0; i < modifierGroupIds.length; i++) {
      await modifierRepository.attachGroupToMenuItem(menuItemId, modifierGroupIds[i], i);
    }

    return modifierRepository.findAllModifierGroupsWithOptionsByMenuItem(menuItemId);
  }

  async detachGroupFromMenuItem(
    menuItemId: string,
    modifierGroupId: string,
  ): Promise<void> {
    await modifierRepository.detachGroupFromMenuItem(menuItemId, modifierGroupId);
  }

  async getModifierGroupsForMenuItem(
    menuItemId: string,
  ): Promise<ModifierGroup[]> {
    return modifierRepository.findAllModifierGroupsWithOptionsByMenuItem(menuItemId);
  }
}

export const modifierService = new ModifierService();