import { Request, Response, NextFunction } from 'express';
import { zomatoService } from './zomato.service';
import { ZomatoOrderWebhookSchema, UpsertMappingSchema } from './zomato.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

export class ZomatoController {
  // ── Webhook ───────────────────────────────────────────────────────────────

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // restaurantId is set by requireRestaurantId middleware — never read from body
      const restaurantId = (req as any).webhookRestaurantId as string;

      const payload = ZomatoOrderWebhookSchema.parse(req.body);

      const result = await zomatoService.processZomatoOrder(restaurantId, payload);

      // Broadcast to KDS
      eventBroadcaster?.broadcastOrderCreated({
        order_id:      result.order_id,
        restaurant_id: restaurantId,
        status:        'CREATED',
        total_amount:  payload.total_amount,
      });

      res.status(200).json(
        successResponse({
          message:        'Zomato order imported successfully',
          unmapped_items: result.unmapped_items,
          warning:        result.unmapped_items.length > 0
            ? `${result.unmapped_items.length} item(s) were not mapped and excluded from the order`
            : undefined,
        }),
      );
    } catch (error) {
      // Use the middleware-validated value; fall back to header for error logging only
      const restaurantId =
        ((req as any).webhookRestaurantId as string | undefined) ||
        (req.headers['x-restaurant-id'] as string | undefined);
      const orderId = req.body?.order_id || 'unknown';
      if (restaurantId && orderId) {
        await zomatoService.logFailedOrder(restaurantId, orderId, (error as Error).message, req.body);
      }
      next(error);
    }
  }

  // ── Sync status ───────────────────────────────────────────────────────────

  async getSyncStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const status = await zomatoService.getSyncStatus(restaurantId);
      res.status(200).json(successResponse(status));
    } catch (error) {
      next(error);
    }
  }

  // ── Item mappings ─────────────────────────────────────────────────────────

  async getMappings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const mappings = await zomatoService.getMappings(restaurantId);
      res.status(200).json(successResponse(mappings));
    } catch (error) {
      next(error);
    }
  }

  async upsertMapping(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const payload = UpsertMappingSchema.parse(req.body);
      const mapping = await zomatoService.upsertMapping(restaurantId, payload);
      res.status(200).json(successResponse(mapping, { message: 'Mapping saved' }));
    } catch (error) {
      next(error);
    }
  }

  async deleteMapping(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      await zomatoService.deleteMapping(req.params.id, restaurantId);
      res.status(200).json(successResponse({ message: 'Mapping deleted' }));
    } catch (error) {
      next(error);
    }
  }
}

export const zomatoController = new ZomatoController();
