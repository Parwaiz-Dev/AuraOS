import { Request, Response, NextFunction } from 'express';
import { ordersService } from './orders.service';
import {
  CreateOrderRequest,
  UpdateOrderRequest,
  CreateOrderRequestSchema,
  UpdateOrderRequestSchema,
  AddOrderItemsRequestSchema,
  UpdateOrderItemStatusSchema,
} from './orders.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';
import { clearDelayAlert } from '@/shared/jobs/delayDetector';

export class OrdersController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const userId = req.user?.userId || null;
      const payload = CreateOrderRequestSchema.parse(req.body) as CreateOrderRequest;
      const result = await ordersService.createOrder(restaurantId, userId, payload);

      // Broadcast real-time event
      eventBroadcaster?.broadcastOrderCreated({
        order_id: result.order.id,
        restaurant_id: restaurantId,
        status: result.order.status,
        total_amount: Number(result.order.total_amount),
        table_id: result.order.table_id,
      });

      res.status(201).json(successResponse(result, { message: 'Order created successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const orders = await ordersService.getOrders(restaurantId, limit, offset);
      res.status(200).json(successResponse(orders));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const order = await ordersService.getOrder(id, restaurantId);
      res.status(200).json(successResponse(order));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /orders/active/by-table/:tableId
   * Returns the open order for a table (if any) so the frontend can offer
   * "add to existing order" instead of creating a new one.
   */
  async getActiveByTable(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { tableId } = req.params;
      const result = await ordersService.getActiveOrderForTable(restaurantId, tableId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/:id/items
   * Append items to an existing open order (running tab).
   */
  async addItems(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      const payload = AddOrderItemsRequestSchema.parse(req.body);
      const result = await ordersService.addItemsToOrder(id, restaurantId, payload.items);

      // Broadcast as an update (items added = order updated)
      eventBroadcaster?.broadcastOrderUpdated({
        order_id: result.order.id,
        restaurant_id: restaurantId,
        status: result.order.status,
        total_amount: Number(result.order.total_amount),
        table_id: result.order.table_id,
      });

      res.status(200).json(successResponse(result, { message: 'Items added to order' }));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      const payload = UpdateOrderRequestSchema.parse(req.body) as UpdateOrderRequest;
      const order = await ordersService.updateOrder(id, restaurantId, payload);

      // Broadcast the right event based on new status
      const broadcastPayload = {
        order_id: order.id,
        restaurant_id: restaurantId,
        status: order.status,
        total_amount: Number(order.total_amount),
        table_id: order.table_id,
        order_number: order.order_number,
      };

      if (order.status === 'COMPLETED') {
        eventBroadcaster?.broadcastOrderCompleted(broadcastPayload);
        clearDelayAlert(order.id);   // remove from delay alert cache
      } else if (order.status === 'CANCELLED') {
        eventBroadcaster?.broadcastOrderCancelled(broadcastPayload);
        clearDelayAlert(order.id);   // remove from delay alert cache
      } else {
        eventBroadcaster?.broadcastOrderUpdated(broadcastPayload);
      }

      res.status(200).json(successResponse(order, { message: 'Order updated successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      await ordersService.deleteOrder(id, restaurantId);

      eventBroadcaster?.broadcastOrderDeleted({
        order_id: id,
        restaurant_id: restaurantId,
        status: 'CANCELLED',
      });

      res.status(200).json(successResponse({ message: 'Order deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const stats = await ordersService.getOrderStats(restaurantId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /orders/:id/items/:itemId
   * Update the status of a single order item (PENDING → PREPARING → DONE).
   * Used by kitchen staff to tick off individual dishes as they're prepared.
   *
   * When all items are marked DONE, the order is automatically advanced to READY.
   */
  async updateItemStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id: orderId, itemId } = req.params;
      const { status } = UpdateOrderItemStatusSchema.parse(req.body);

      const result = await ordersService.updateItemStatus(orderId, itemId, restaurantId, status);

      // If all items are done, the order was auto-advanced to READY — broadcast it
      if (result.orderAutoAdvanced && result.order) {
        eventBroadcaster?.broadcastOrderUpdated({
          order_id: result.order.id,
          restaurant_id: restaurantId,
          status: result.order.status,
          total_amount: Number(result.order.total_amount),
          table_id: result.order.table_id,
        });
      }

      res.status(200).json(
        successResponse(
          { item: result.item, order_auto_advanced: result.orderAutoAdvanced },
          {
            message: result.orderAutoAdvanced
              ? 'All items done — order marked READY'
              : 'Item status updated',
          },
        ),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const ordersController = new OrdersController();