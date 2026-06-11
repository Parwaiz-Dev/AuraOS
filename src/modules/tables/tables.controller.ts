import { Request, Response, NextFunction } from 'express';
import { tablesService } from './tables.service';
import {
  CreateTableRequest,
  UpdateTableRequest,
  CreateTableRequestSchema,
  UpdateTableRequestSchema,
} from './tables.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

export class TablesController {
  /**
   * POST /api/v1/tables
   * Create a new table (Admin only)
   */
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const payload = CreateTableRequestSchema.parse(req.body) as CreateTableRequest;
      const table = await tablesService.createTable(restaurantId, payload);

      eventBroadcaster?.broadcastTableCreated({
        table_id: table.id,
        restaurant_id: restaurantId,
        table_number: table.table_number,
        status: 'freed',
      });

      res.status(201).json(successResponse(table, { message: 'Table created successfully' }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tables
   * Get all tables for current restaurant
   */
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const tables = await tablesService.getAllTables(restaurantId, limit, offset);
      const total = await tablesService.getTableCount(restaurantId);

      res.status(200).json(
        successResponse(tables, {
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tables/with-status
   * Get all tables enriched with their current active order (occupancy view).
   * Powers the Tables command-center screen — colour-coded free/occupied/ready.
   */
  async getAllWithStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const tables = await tablesService.getTablesWithStatus(restaurantId);
      res.status(200).json(successResponse(tables));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tables/:id
   * Get specific table by ID
   */
  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const table = await tablesService.getTable(id);

      // Ensure table belongs to user's restaurant
      if (table.restaurant_id !== restaurantId) {
        throw new Error('Table not found');
      }

      res.status(200).json(successResponse(table));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/tables/:id
   * Update table settings (Admin only)
   */
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const payload = UpdateTableRequestSchema.parse(req.body) as UpdateTableRequest;
      const table = await tablesService.updateTable(id, restaurantId, payload);

      eventBroadcaster?.broadcastTableUpdated({
        table_id: table.id,
        restaurant_id: restaurantId,
        table_number: table.table_number,
        status: 'freed',
      });

      res.status(200).json(successResponse(table, { message: 'Table updated successfully' }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/tables/:id
   * Delete table (Admin only - dangerous operation)
   */
  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      await tablesService.deleteTable(id, restaurantId);

      eventBroadcaster?.broadcastTableDeleted(restaurantId, id);

      res.status(200).json(successResponse({ message: 'Table deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tables/stats
   * Get table statistics (Admin only)
   */
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const stats = await tablesService.getTableStats(restaurantId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }
}

export const tablesController = new TablesController();