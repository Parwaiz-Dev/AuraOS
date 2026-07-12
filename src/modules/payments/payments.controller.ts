import { Request, Response, NextFunction } from 'express';
import { paymentsService } from './payments.service';
import { CreatePaymentRequestSchema, UpdatePaymentRequestSchema } from './payments.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { parsePagination, paginatedResponse } from '@/shared/utils/pagination';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

export class PaymentsController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const payload = CreatePaymentRequestSchema.parse(req.body);
      const payment = await paymentsService.createPayment(restaurantId, payload);

      eventBroadcaster?.broadcastPaymentCreated({
        payment_id: payment.id,
        restaurant_id: restaurantId,
        order_id: payment.order_id,
        status: payment.status,
        amount: Number(payment.amount),
      });

      res.status(201).json(successResponse(payment, { message: 'Payment created successfully' }));
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

      const pagination = parsePagination(req.query);
      const statusFilter = req.query.status as string | undefined;
      const method = req.query.method as string | undefined;

      const { items, total } = await paymentsService.getPayments(
        restaurantId, pagination.limit, pagination.offset, statusFilter, method,
      );
      res.status(200).json(successResponse(paginatedResponse(items, total, pagination)));
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
      const payment = await paymentsService.getPayment(id, restaurantId);
      res.status(200).json(successResponse(payment));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      const payload = UpdatePaymentRequestSchema.parse(req.body);
      const payment = await paymentsService.updatePayment(id, restaurantId, payload);
      res.status(200).json(successResponse(payment, { message: 'Payment updated successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const { id } = req.params;
      await paymentsService.deletePayment(id, restaurantId);
      res.status(200).json(successResponse({ message: 'Payment deleted successfully' }));
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

      const stats = await paymentsService.getPaymentStats(restaurantId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }
}

export const paymentsController = new PaymentsController();
