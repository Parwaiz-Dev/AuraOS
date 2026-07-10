/**
 * Razorpay Payment Gateway
 *
 * Handles:
 *   1. Creating a Razorpay order (returns payment_url for checkout)
 *   2. Verifying webhook signatures from Razorpay
 *   3. Verifying payment signatures after client-side checkout
 *
 * SETUP
 * ─────
 * 1. Create account: https://dashboard.razorpay.com
 * 2. Get API keys: Settings → API Keys → Generate Key
 * 3. Add to .env:
 *      PAYMENT_GATEWAY=razorpay
 *      RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
 *      RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
 *      RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
 * 4. Set webhook URL in Razorpay dashboard:
 *      https://YOUR_DOMAIN/api/v1/webhooks/payments/razorpay
 *    Events to subscribe: payment.captured, payment.failed, refund.created
 *
 * TEST CARDS (test mode)
 * ──────────────────────
 *   Card:  4111 1111 1111 1111  Expiry: any future  CVV: any
 *   UPI:   success@razorpay
 *   UPI fail: failure@razorpay
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '@/config/env';

// Lazily initialised — only created when gateway is actually used
let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (razorpayInstance) return razorpayInstance;

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      'Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env',
    );
  }

  razorpayInstance = new Razorpay({
    key_id:     env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });

  return razorpayInstance;
}

export interface RazorpayOrderResult {
  razorpay_order_id: string;  // e.g. "order_abc123"
  amount:            number;  // in paise (₹1 = 100 paise)
  currency:          string;  // "INR"
  key_id:            string;  // public key for frontend checkout
}

/**
 * Create a Razorpay order.
 * Returns the order ID and public key needed to open the Razorpay checkout.
 *
 * @param internalOrderId  Your internal order UUID (stored as receipt)
 * @param amountRupees     Amount in rupees (will be converted to paise)
 * @param currency         Default: INR
 */
export async function createRazorpayOrder(
  internalOrderId: string,
  amountRupees: number,
  currency = 'INR',
): Promise<RazorpayOrderResult> {
  const rz = getRazorpay();

  const order = await rz.orders.create({
    amount:   Math.round(amountRupees * 100), // convert to paise
    currency,
    receipt:  internalOrderId,               // your internal order ID
    notes: {
      internal_order_id: internalOrderId,
    },
  });

  return {
    razorpay_order_id: order.id,
    amount:            order.amount as number,
    currency:          order.currency,
    key_id:            env.RAZORPAY_KEY_ID,
  };
}

/**
 * Verify the webhook signature from Razorpay.
 * Called in the webhook handler before processing any event.
 *
 * Razorpay sends X-Razorpay-Signature header with HMAC-SHA256 of the raw body.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    // Fail closed in production — an unconfigured secret must never mean
    // "trust everything". Only allow the bypass in non-production for local dev.
    if (env.NODE_ENV === 'production') {
      console.error('[Razorpay] RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook in production');
      return false;
    }
    console.warn('[Razorpay] RAZORPAY_WEBHOOK_SECRET not set — skipping signature check (dev mode)');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

/**
 * Verify the payment signature after client-side checkout completes.
 * The frontend receives razorpay_payment_id + razorpay_order_id + razorpay_signature
 * and sends them to your backend for verification.
 *
 * This is the final step before marking a payment as PAID.
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}
