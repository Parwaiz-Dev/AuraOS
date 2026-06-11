import { menuRepository } from './menu.repository';
import {
  MenuCategory,
  MenuItem,
  MenuStats,
  CreateMenuCategoryRequest,
  UpdateMenuCategoryRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
} from './menu.types';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';

export class MenuService {
  validateCategoryName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 255) {
      throw new BadRequestError('Category name must be between 2 and 255 characters');
    }
    return trimmed;
  }

  validateMenuItemName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 255) {
      throw new BadRequestError('Menu item name must be between 2 and 255 characters');
    }
    return trimmed;
  }

  async createCategory(restaurantId: string, payload: CreateMenuCategoryRequest): Promise<MenuCategory> {
    const { name, description, display_order, is_active } = payload;
    const validatedName = this.validateCategoryName(name);

    if (await menuRepository.categoryNameExists(restaurantId, validatedName)) {
      throw new ConflictError('Menu category name already exists for this restaurant');
    }

    return menuRepository.createCategory(restaurantId, validatedName, description ?? null, display_order, is_active);
  }

  async getCategory(categoryId: string): Promise<MenuCategory> {
    const category = await menuRepository.findCategoryById(categoryId);
    if (!category) {
      throw new NotFoundError('Menu category not found');
    }
    return category;
  }

  async getCategories(restaurantId: string): Promise<MenuCategory[]> {
    return menuRepository.findCategoriesByRestaurantId(restaurantId);
  }

  async updateCategory(categoryId: string, restaurantId: string, payload: UpdateMenuCategoryRequest): Promise<MenuCategory> {
    const existing = await this.getCategory(categoryId);
    if (existing.restaurant_id !== restaurantId) {
      throw new NotFoundError('Menu category not found');
    }

    const updates: any = {};
    if (payload.name !== undefined) {
      const validatedName = this.validateCategoryName(payload.name);
      if (validatedName !== existing.name && await menuRepository.categoryNameExists(restaurantId, validatedName, categoryId)) {
        throw new ConflictError('Menu category name already exists for this restaurant');
      }
      updates.name = validatedName;
    }
    if (payload.description !== undefined) {
      updates.description = payload.description ?? null;
    }
    if (payload.display_order !== undefined) {
      updates.display_order = payload.display_order;
    }
    if (payload.is_active !== undefined) {
      updates.is_active = payload.is_active;
    }

    const updated = await menuRepository.updateCategory(categoryId, updates);
    if (!updated) {
      throw new NotFoundError('Menu category not found');
    }
    return updated;
  }

  async deleteCategory(categoryId: string, restaurantId: string): Promise<void> {
    const category = await this.getCategory(categoryId);
    if (category.restaurant_id !== restaurantId) {
      throw new NotFoundError('Menu category not found');
    }

    const deleted = await menuRepository.deleteCategory(categoryId);
    if (!deleted) {
      throw new NotFoundError('Menu category not found');
    }
  }

  async createMenuItem(restaurantId: string, payload: CreateMenuItemRequest): Promise<MenuItem> {
    const { category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order } = payload;
    const validatedName = this.validateMenuItemName(name);

    const category = await this.getCategory(category_id);
    if (category.restaurant_id !== restaurantId) {
      throw new BadRequestError('Menu category does not belong to this restaurant');
    }

    if (await menuRepository.menuItemNameExists(restaurantId, validatedName)) {
      throw new ConflictError('Menu item name already exists for this restaurant');
    }

    return menuRepository.createMenuItem(
      restaurantId,
      category_id,
      validatedName,
      description ?? null,
      price,
      prep_time_minutes,
      is_vegetarian,
      is_active,
      display_order
    );
  }

  async getMenuItem(menuItemId: string): Promise<MenuItem> {
    const item = await menuRepository.findMenuItemById(menuItemId);
    if (!item) {
      throw new NotFoundError('Menu item not found');
    }
    return item;
  }

  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    return menuRepository.findMenuItemsByRestaurantId(restaurantId);
  }

  async updateMenuItem(menuItemId: string, restaurantId: string, payload: UpdateMenuItemRequest): Promise<MenuItem> {
    const existing = await this.getMenuItem(menuItemId);
    if (existing.restaurant_id !== restaurantId) {
      throw new NotFoundError('Menu item not found');
    }

    const updates: any = {};
    if (payload.category_id !== undefined) {
      const category = await this.getCategory(payload.category_id);
      if (category.restaurant_id !== restaurantId) {
        throw new BadRequestError('Menu category does not belong to this restaurant');
      }
      updates.category_id = payload.category_id;
    }
    if (payload.name !== undefined) {
      const validatedName = this.validateMenuItemName(payload.name);
      if (validatedName !== existing.name && await menuRepository.menuItemNameExists(restaurantId, validatedName, menuItemId)) {
        throw new ConflictError('Menu item name already exists for this restaurant');
      }
      updates.name = validatedName;
    }
    if (payload.description !== undefined) {
      updates.description = payload.description ?? null;
    }
    if (payload.price !== undefined) {
      updates.price = payload.price;
    }
    if (payload.prep_time_minutes !== undefined) {
      updates.prep_time_minutes = payload.prep_time_minutes;
    }
    if (payload.is_vegetarian !== undefined) {
      updates.is_vegetarian = payload.is_vegetarian;
    }
    if (payload.is_active !== undefined) {
      updates.is_active = payload.is_active;
    }
    if (payload.display_order !== undefined) {
      updates.display_order = payload.display_order;
    }

    const updated = await menuRepository.updateMenuItem(menuItemId, updates);
    if (!updated) {
      throw new NotFoundError('Menu item not found');
    }
    return updated;
  }

  async deleteMenuItem(menuItemId: string, restaurantId: string): Promise<void> {
    const item = await this.getMenuItem(menuItemId);
    if (item.restaurant_id !== restaurantId) {
      throw new NotFoundError('Menu item not found');
    }

    const deleted = await menuRepository.deleteMenuItem(menuItemId);
    if (!deleted) {
      throw new NotFoundError('Menu item not found');
    }
  }

  async getMenuOverview(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const [categories, items] = await Promise.all([
      this.getCategories(restaurantId),
      this.getMenuItems(restaurantId),
    ]);
    return { categories, items };
  }

  async getMenuStats(restaurantId: string): Promise<MenuStats> {
    return menuRepository.getMenuStats(restaurantId);
  }
}

export const menuService = new MenuService();