/**
 * Payment Webhook Handler
 *
 * Receives payment events from Razorpay (and future gateways).
 * Verifies the signature, then updates payment + order status.
 *
 * Routes registered in app.ts:
 *   POST /api/v1/webhooks/payments/razorpay
 *
 * Razorpay events handled:
 *   payment.captured  → mark payment PAID, order ACCEPTED
 *   payment.failed    → mark payment FAILED (keep as PENDING for retry)
 *   refund.created    → mark payment REFUNDED
 *
 * IMPORTANT: Always respond 200 quickly. Razorpay retries if it doesn't
 * get a 200 within 5 seconds. Process asynchronously if needed.
 */

import { Router, Request, Response } from 'express';
import { query } from '@/config/database';
import { verifyWebhookSignature } from './gateways/razorpay.gateway';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

const router = Router();

/**
 * POST /api/v1/webhooks/payments/razorpay
 *
 * Razorpay sends this when a payment is captured, failed, or refunded.
 *
 * The raw request body is captured globally by the express.json({ verify })
 * hook in app.ts and exposed as req.rawBody, which we verify the HMAC against.
 */
router.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;

    // Fail closed: a webhook with no signature header is never trusted.
    if (!signature) {
      console.warn('[Razorpay Webhook] Missing signature header — rejecting');
      res.status(400).json({ received: false, error: 'Missing signature' });
      return;
    }

    if (!rawBody) {
      console.error('[Razorpay Webhook] rawBody unavailable — cannot verify signature');
      res.status(400).json({ received: false, error: 'Cannot verify signature' });
      return;
    }

    // Verify signature before doing any work.
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[Razorpay Webhook] Invalid signature — rejecting');
      res.status(400).json({ received: false, error: 'Invalid signature' });
      return;
    }

    const event = req.body?.event as string;
    const paymentEntity = req.body?.payload?.payment?.entity;
    const refundEntity  = req.body?.payload?.refund?.entity;

    console.log(`[Razorpay Webhook] Event: ${event}`);

    if (event === 'payment.captured' && paymentEntity) {
      await handlePaymentCaptured(paymentEntity);
    } else if (event === 'payment.failed' && paymentEntity) {
      await handlePaymentFailed(paymentEntity);
    } else if (event === 'refund.created' && refundEntity) {
      await handleRefundCreated(refundEntity);
    }

    // Respond 200 only after processing completes — this way a crash during
    // processing means Razorpay does NOT get 200 and will retry the event.
    // Processing must complete within Razorpay's 5-second response window.
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Razorpay Webhook] Processing error:', err);
    // Respond 200 even on error so Razorpay doesn't retry indefinitely for
    // events we've already partially processed (e.g. payment marked PAID but
    // order update failed). For truly transient errors a retry is acceptable.
    res.status(200).json({ received: true, error: 'Processing error — check server logs' });
  }
});

// ─── Event handlers ──────────────────────────────────────────────────────────

/**
 * payment.captured — customer paid successfully.
 * 1. Find the payment record by razorpay_order_id (stored in reference_number)
 * 2. Mark payment as PAID
 * 3. Advance order to ACCEPTED (so kitchen sees it)
 * 4. Broadcast Socket.io events
 */
async function handlePaymentCaptured(entity: any): Promise<void> {
  const razorpayOrderId  = entity.order_id;
  const razorpayPaymentId = entity.id;
  const amountPaise      = entity.amount; // in paise

  // Find payment by razorpay order ID stored in reference_number
  const paymentResult = await query(
    `SELECT id, restaurant_id, order_id, amount
     FROM payments
     WHERE reference_number = $1 AND status = 'PENDING'
     LIMIT 1`,
    [razorpayOrderId],
  );

  if (paymentResult.rows.length === 0) {
    console.warn(`[Razorpay] No pending payment found for order ${razorpayOrderId}`);
    return;
  }

  const payment = paymentResult.rows[0];

  // Mark payment as PAID, store Razorpay payment ID
  await query(
    `UPDATE payments
     SET status = 'PAID',
         reference_number = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [razorpayPaymentId, payment.id],
  );

  // Advance order to ACCEPTED (was CREATED, now kitchen can see it)
  const orderResult = await query(
    `UPDATE orders
     SET status = 'ACCEPTED', updated_at = NOW()
     WHERE id = $1 AND status = 'CREATED'
     RETURNING id, restaurant_id, table_id, total_amount, status`,
    [payment.order_id],
  );

  const order = orderResult.rows[0];
  if (!order) {
    console.warn(`[Razorpay] Order ${payment.order_id} not in CREATED state — skipping advance`);
    return;
  }

  console.log(`[Razorpay] ✅ Payment captured — order ${payment.order_id} → ACCEPTED`);

  // Broadcast to all connected clients in the restaurant room
  eventBroadcaster?.broadcastPaymentCompleted({
    payment_id:    payment.id,
    restaurant_id: payment.restaurant_id,
    order_id:      payment.order_id,
    status:        'PAID',
    amount:        amountPaise / 100,
  });

  eventBroadcaster?.broadcastOrderUpdated({
    order_id:      order.id,
    restaurant_id: order.restaurant_id,
    status:        order.status,
    total_amount:  Number(order.total_amount),
    table_id:      order.table_id,
  });
}

/**
 * payment.failed — customer's payment attempt failed.
 * Keep the payment as PENDING so they can retry.
 * Log the failure reason.
 */
async function handlePaymentFailed(entity: any): Promise<void> {
  const razorpayOrderId = entity.order_id;
  const errorDesc       = entity.error_description || 'Payment failed';

  console.warn(`[Razorpay] ❌ Payment failed for order ${razorpayOrderId}: ${errorDesc}`);

  // Optionally update a failure reason field — for now just log
  // The payment stays PENDING so the customer can retry
}

/**
 * refund.created — a refund was initiated.
 * Mark the payment as REFUNDED.
 */
async function handleRefundCreated(entity: any): Promise<void> {
  const razorpayPaymentId = entity.payment_id;

  const result = await query(
    `UPDATE payments
     SET status = 'REFUNDED', updated_at = NOW()
     WHERE reference_number = $1
     RETURNING id, restaurant_id, order_id, amount`,
    [razorpayPaymentId],
  );

  if (result.rows.length > 0) {
    const payment = result.rows[0];
    console.log(`[Razorpay] 💸 Refund created for payment ${razorpayPaymentId}`);

    eventBroadcaster?.broadcastPaymentUpdated({
      payment_id:    payment.id,
      restaurant_id: payment.restaurant_id,
      order_id:      payment.order_id,
      status:        'REFUNDED',
      amount:        Number(payment.amount),
    });
  }
}

export default router;
