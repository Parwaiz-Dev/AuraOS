import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';
import { CreateInventoryItemRequestSchema, UpdateInventoryItemRequestSchema } from './inventory.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

export class InventoryController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const payload = CreateInventoryItemRequestSchema.parse(req.body);
      const item = await inventoryService.createInventoryItem(
        restaurantId,
        payload,
        req.user?.userId,
      );
      res.status(201).json(successResponse(item, { message: 'Inventory item created successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const limit  = parseInt(req.query.limit  as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const items = await inventoryService.getInventoryItems(restaurantId, limit, offset);
      res.status(200).json(successResponse(items));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const item = await inventoryService.getInventoryItem(req.params.id, restaurantId);
      res.status(200).json(successResponse(item));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      const payload = UpdateInventoryItemRequestSchema.parse(req.body);

      // Extract optional notes from request body (not part of the Zod schema)
      const notes = (req.body as any).notes as string | undefined;

      const item = await inventoryService.updateInventoryItem(
        id,
        restaurantId,
        payload,
        req.user?.userId,
        notes ?? null,
      );

      // Broadcast update
      eventBroadcaster?.broadcastInventoryUpdated({
        inventory_item_id: item.id,
        restaurant_id:     restaurantId,
        menu_item_id:      item.menu_item_id,
        current_stock:     item.current_stock,
        reorder_level:     item.reorder_level,
      });

      // Broadcast low-stock alert if threshold crossed
      if (item.current_stock <= item.reorder_level) {
        eventBroadcaster?.broadcastInventoryLowStock({
          inventory_item_id: item.id,
          restaurant_id:     restaurantId,
          menu_item_id:      item.menu_item_id,
          current_stock:     item.current_stock,
          reorder_level:     item.reorder_level,
        });
      }

      res.status(200).json(successResponse(item, { message: 'Inventory item updated successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      await inventoryService.deleteInventoryItem(req.params.id, restaurantId);
      res.status(200).json(successResponse({ message: 'Inventory item deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const stats = await inventoryService.getInventoryStats(restaurantId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /inventory/:id/history
   * Returns the full change log for a single inventory item.
   */
  async getItemHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const limit  = parseInt(req.query.limit  as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await inventoryService.getItemHistory(req.params.id, restaurantId, limit, offset);
      res.status(200).json(successResponse(history));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /inventory/history
   * Returns recent stock changes across all items for the restaurant.
   */
  async getRestaurantHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const limit  = parseInt(req.query.limit  as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await inventoryService.getRestaurantHistory(restaurantId, limit, offset);
      res.status(200).json(successResponse(history));
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryController = new InventoryController();
