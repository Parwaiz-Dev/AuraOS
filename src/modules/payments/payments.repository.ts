import { pool, query } from '@/config/database';
import { Payment, PaymentStats } from './payments.types';

export class PaymentsRepository {
  async createPayment(
    restaurantId: string,
    orderId: string,
    amount: number,
    method: Payment['method'],
    status: Payment['status'],
    referenceNumber: string | null
  ): Promise<Payment> {
    const result = await query(
      `INSERT INTO payments (restaurant_id, order_id, amount, method, status, reference_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, restaurant_id, order_id, amount, method, status, reference_number, created_at, updated_at`,
      [restaurantId, orderId, amount, method, status, referenceNumber]
    );

    return result.rows[0];
  }

  /**
   * Atomically validate and insert a payment inside a single transaction.
   *
   * Uses SELECT ... FOR UPDATE on the order row so that concurrent requests
   * are serialised at the DB level — only one can read the paid amount and
   * insert a new payment at a time.  The second request blocks until the
   * first transaction commits, then re-reads the updated paid total and
   * either proceeds or is rejected by the duplicate/overpayment guard.
   *
   * Returns the new Payment on success, or throws with a descriptive message
   * if the order is cancelled, already fully paid, or the amount exceeds the
   * remaining balance.
   */
  async createPaymentAtomic(
    restaurantId: string,
    orderId: string,
    amount: number,
    method: Payment['method'],
    status: Payment['status'],
    referenceNumber: string | null,
  ): Promise<Payment> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the order row for the duration of this transaction.
      // Any concurrent createPaymentAtomic call on the same order will wait here.
      const orderResult = await client.query(
        `SELECT id, restaurant_id, status, total_amount
         FROM orders
         WHERE id = $1
         FOR UPDATE`,
        [orderId],
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      if (order.restaurant_id !== restaurantId) {
        throw new Error('Order does not belong to this restaurant');
      }

      if (order.status === 'CANCELLED') {
        throw new Error('Cannot record payment for a cancelled order');
      }

      const orderTotal = Number(order.total_amount || 0);

      // Sum all PAID payments for this order inside the same transaction
      // so we see the definitive committed state, not a stale snapshot.
      const paidResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid
         FROM payments
         WHERE order_id = $1 AND status = 'PAID'`,
        [orderId],
      );
      const alreadyPaid = Number(paidResult.rows[0].paid);

      if (status === 'PAID' && orderTotal > 0 && alreadyPaid >= orderTotal) {
        throw new Error(
          `This order is already fully paid (₹${alreadyPaid.toFixed(2)} collected of ₹${orderTotal.toFixed(2)})`,
        );
      }

      const balance = Math.max(0, orderTotal - alreadyPaid);

      if (status === 'PAID' && amount > balance + 0.01) {
        throw new Error(
          `Payment amount (₹${amount.toFixed(2)}) exceeds the remaining balance (₹${balance.toFixed(2)})`,
        );
      }

      // Insert the payment
      const paymentResult = await client.query(
        `INSERT INTO payments (restaurant_id, order_id, amount, method, status, reference_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, restaurant_id, order_id, amount, method, status, reference_number, created_at, updated_at`,
        [restaurantId, orderId, amount, method, status, referenceNumber],
      );

      const payment: Payment = paymentResult.rows[0];

      // Auto-complete the order when fully paid — inside the same transaction
      if (status === 'PAID') {
        const newPaid = alreadyPaid + Number(amount);
        if (newPaid >= orderTotal && order.status !== 'COMPLETED') {
          await client.query(
            `UPDATE orders
             SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [orderId],
          );
        }
      }

      await client.query('COMMIT');
      return payment;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(paymentId: string): Promise<Payment | null> {
    const result = await query(
      `SELECT id, restaurant_id, order_id, amount, method, status, reference_number, created_at, updated_at
       FROM payments
       WHERE id = $1
       LIMIT 1`,
      [paymentId]
    );
    return result.rows[0] || null;
  }

  async findByRestaurantId(restaurantId: string, limit: number = 50, offset: number = 0): Promise<Payment[]> {
    const result = await query(
      `SELECT
         p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status,
         p.reference_number, p.created_at, p.updated_at,
         o.order_number,
         o.order_type,
         rt.table_number
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       WHERE p.restaurant_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [restaurantId, limit, offset]
    );
    return result.rows;
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const result = await query(
      `SELECT id, restaurant_id, order_id, amount, method, status, reference_number, created_at, updated_at
       FROM payments
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId]
    );
    return result.rows;
  }

  async update(paymentId: string, updates: Partial<{
    amount: number;
    method: Payment['method'];
    status: Payment['status'];
    reference_number: string | null;
  }>): Promise<Payment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    if (updates.method !== undefined) {
      fields.push(`method = $${paramIndex++}`);
      values.push(updates.method);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.reference_number !== undefined) {
      fields.push(`reference_number = $${paramIndex++}`);
      values.push(updates.reference_number);
    }

    if (fields.length === 0) {
      return this.findById(paymentId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(paymentId);

    const result = await query(
      `UPDATE payments SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, restaurant_id, order_id, amount, method, status, reference_number, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(paymentId: string): Promise<boolean> {
    const result = await query('DELETE FROM payments WHERE id = $1', [paymentId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(restaurantId: string): Promise<PaymentStats> {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS payments_today,
         COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND DATE(created_at) = CURRENT_DATE), 0) AS paid_amount_today,
         COALESCE(SUM(amount) FILTER (WHERE status = 'REFUNDED' AND DATE(created_at) = CURRENT_DATE), 0) AS refunded_amount_today,
         COUNT(*) FILTER (WHERE status = 'PENDING' AND DATE(created_at) = CURRENT_DATE) AS pending_payments_today
       FROM payments
       WHERE restaurant_id = $1`,
      [restaurantId]
    );

    const stats = result.rows[0];
    return {
      payments_today: parseInt(stats.payments_today, 10) || 0,
      paid_amount_today: parseFloat(stats.paid_amount_today) || 0,
      refunded_amount_today: parseFloat(stats.refunded_amount_today) || 0,
      pending_payments_today: parseInt(stats.pending_payments_today, 10) || 0,
    };
  }

  async countByRestaurantId(
    restaurantId: string,
    statusFilter?: string,
    methodFilter?: string,
  ): Promise<number> {
    const conditions = ['restaurant_id = $1'];
    const params: any[] = [restaurantId];
    if (statusFilter) { params.push(statusFilter); conditions.push(`status = $${params.length}`); }
    if (methodFilter) { params.push(methodFilter); conditions.push(`method = $${params.length}`); }
    const result = await query(
      `SELECT COUNT(*)::int AS total FROM payments WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return result.rows[0].total;
  }

  async findByRestaurantIdFiltered(
    restaurantId: string,
    limit: number,
    offset: number,
    statusFilter?: string,
    methodFilter?: string,
  ): Promise<Payment[]> {
    const conditions = ['p.restaurant_id = $1'];
    const params: any[] = [restaurantId];
    if (statusFilter) { params.push(statusFilter); conditions.push(`p.status = $${params.length}`); }
    if (methodFilter) { params.push(methodFilter); conditions.push(`p.method = $${params.length}`); }
    params.push(limit, offset);
    const result = await query(
      `SELECT
         p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status,
         p.reference_number, p.created_at, p.updated_at,
         o.order_number, o.order_type, rt.table_number
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return result.rows;
  }
}

export const paymentsRepository = new PaymentsRepository();
