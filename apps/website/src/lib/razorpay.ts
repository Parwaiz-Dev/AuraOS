'use client';

import { verifyPayment, type PlaceOrderResult } from '@/lib/client';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let sdkPromise: Promise<boolean> | null = null;

/** Lazy-load the Razorpay checkout SDK once. */
function loadRazorpaySdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return sdkPromise;
}

/**
 * Open Razorpay checkout for an order whose API response included `razorpay`,
 * then verify the signature with Core. Resolves true when payment is confirmed.
 *
 * Throws if the SDK can't load or the order has no razorpay payload (caller
 * should fall back to treating the order as pending/COD).
 */
export async function payWithRazorpay(
  order: PlaceOrderResult,
  opts: { name: string; customerName?: string; customerPhone?: string },
): Promise<boolean> {
  if (!order.razorpay) throw new Error('No online payment configured for this order');
  const ok = await loadRazorpaySdk();
  if (!ok || !window.Razorpay) throw new Error('Could not load payment SDK');

  const { razorpay } = order;

  return new Promise<boolean>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: razorpay.key_id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      order_id: razorpay.razorpay_order_id,
      name: opts.name,
      description: `Order ${order.order_number}`,
      prefill: { name: opts.customerName || '', contact: opts.customerPhone || '' },
      handler: async (resp: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const result = await verifyPayment({
            order_id: order.order_id,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          resolve(result.verified);
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.open();
  });
}
