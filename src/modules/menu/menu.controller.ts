import { Request, Response, NextFunction } from 'express';
import { menuService } from './menu.service';
import {
  CreateMenuCategoryRequest,
  UpdateMenuCategoryRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
  CreateMenuCategoryRequestSchema,
  UpdateMenuCategoryRequestSchema,
  CreateMenuItemRequestSchema,
  UpdateMenuItemRequestSchema,
} from './menu.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';

export class MenuController {
  async getMenu(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const menu = await menuService.getMenuOverview(restaurantId);
      res.status(200).json(successResponse(menu));
    } catch (error) {
      next(error);
    }
  }

  async getMenuStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const stats = await menuService.getMenuStats(restaurantId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const payload = CreateMenuCategoryRequestSchema.parse(req.body) as CreateMenuCategoryRequest;
      const category = await menuService.createCategory(restaurantId, payload);
      res.status(201).json(
        successResponse(category, { message: 'Menu category created successfully' })
      );
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const categories = await menuService.getCategories(restaurantId);
      res.status(200).json(successResponse(categories));
    } catch (error) {
      next(error);
    }
  }

  async getCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const category = await menuService.getCategory(id);
      if (category.restaurant_id !== restaurantId) {
        throw new Error('Menu category not found');
      }

      res.status(200).json(successResponse(category));
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const payload = UpdateMenuCategoryRequestSchema.parse(req.body) as UpdateMenuCategoryRequest;
      const category = await menuService.updateCategory(id, restaurantId, payload);
      res.status(200).json(
        successResponse(category, { message: 'Menu category updated successfully' })
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      await menuService.deleteCategory(id, restaurantId);
      res.status(200).json(successResponse({ message: 'Menu category deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async createMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const payload = CreateMenuItemRequestSchema.parse(req.body) as CreateMenuItemRequest;
      const item = await menuService.createMenuItem(restaurantId, payload);
      res.status(201).json(
        successResponse(item, { message: 'Menu item created successfully' })
      );
    } catch (error) {
      next(error);
    }
  }

  async getMenuItems(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const items = await menuService.getMenuItems(restaurantId);
      res.status(200).json(successResponse(items));
    } catch (error) {
      next(error);
    }
  }

  async getMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const item = await menuService.getMenuItem(id);
      if (item.restaurant_id !== restaurantId) {
        throw new Error('Menu item not found');
      }

      res.status(200).json(successResponse(item));
    } catch (error) {
      next(error);
    }
  }

  async updateMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const payload = UpdateMenuItemRequestSchema.parse(req.body) as UpdateMenuItemRequest;
      const item = await menuService.updateMenuItem(id, restaurantId, payload);
      res.status(200).json(
        successResponse(item, { message: 'Menu item updated successfully' })
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      await menuService.deleteMenuItem(id, restaurantId);
      res.status(200).json(successResponse({ message: 'Menu item deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }
}

export const menuController = new MenuController();