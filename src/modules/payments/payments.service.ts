import { ordersRepository } from '@/modules/orders/orders.repository';
import { paymentsRepository } from './payments.repository';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { CreatePaymentRequest, Payment, UpdatePaymentRequest, PaymentStats } from './payments.types';

export class PaymentsService {
  async createPayment(restaurantId: string, payload: CreatePaymentRequest): Promise<Payment> {
    // Verify the order exists and belongs to this restaurant before acquiring the lock.
    // The atomic method re-checks inside the transaction — this is just a fast early exit.
    const order = await ordersRepository.findById(payload.order_id);
    if (!order || order.restaurant_id !== restaurantId) {
      throw new BadRequestError('Order does not belong to this restaurant');
    }

    const status = payload.status ?? 'PENDING';

    // All duplicate-payment and overpayment validation happens atomically inside
    // createPaymentAtomic — concurrent requests on the same order are serialised
    // at the database level via SELECT ... FOR UPDATE on the order row.
    try {
      return await paymentsRepository.createPaymentAtomic(
        restaurantId,
        payload.order_id,
        payload.amount,
        payload.method,
        status,
        payload.reference_number ?? null,
      );
    } catch (err) {
      // Re-throw DB-layer validation errors as HTTP 400s
      const msg = (err as Error).message;
      if (
        msg.includes('already fully paid') ||
        msg.includes('exceeds the remaining balance') ||
        msg.includes('cancelled order') ||
        msg.includes('does not belong')
      ) {
        throw new BadRequestError(msg);
      }
      throw err;
    }
  }

  async getPayment(paymentId: string, restaurantId: string): Promise<Payment> {
    const payment = await paymentsRepository.findById(paymentId);
    if (!payment || payment.restaurant_id !== restaurantId) {
      throw new NotFoundError('Payment not found');
    }
    return payment;
  }

  async getPayments(restaurantId: string, limit: number = 50, offset: number = 0): Promise<Payment[]> {
    return paymentsRepository.findByRestaurantId(restaurantId, limit, offset);
  }

  async updatePayment(paymentId: string, restaurantId: string, payload: UpdatePaymentRequest): Promise<Payment> {
    const payment = await paymentsRepository.findById(paymentId);
    if (!payment || payment.restaurant_id !== restaurantId) {
      throw new NotFoundError('Payment not found');
    }

    if (payload.amount !== undefined && payload.amount <= 0) {
      throw new BadRequestError('Payment amount must be a positive number');
    }

    const updated = await paymentsRepository.update(paymentId, {
      amount: payload.amount,
      method: payload.method,
      status: payload.status,
      reference_number: payload.reference_number ?? payment.reference_number,
    });

    if (!updated) {
      throw new NotFoundError('Payment update failed');
    }

    return updated;
  }

  async deletePayment(paymentId: string, restaurantId: string): Promise<void> {
    const payment = await paymentsRepository.findById(paymentId);
    if (!payment || payment.restaurant_id !== restaurantId) {
      throw new NotFoundError('Payment not found');
    }

    const deleted = await paymentsRepository.delete(paymentId);
    if (!deleted) {
      throw new NotFoundError('Payment not found');
    }
  }

  async getPaymentStats(restaurantId: string): Promise<PaymentStats> {
    return paymentsRepository.getStats(restaurantId);
  }
}

export const paymentsService = new PaymentsService();
