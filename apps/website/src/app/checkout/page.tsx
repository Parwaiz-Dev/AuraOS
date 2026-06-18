'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useTenantSlug } from '@/components/Providers';
import {
  requestOtp, verifyOtp, getMe, placeOrder,
  getCustomerToken, setCustomerToken,
  type PlaceOrderPayload,
} from '@/lib/client';
import { payWithRazorpay } from '@/lib/razorpay';

type Step = 'login' | 'otp' | 'details';

export default function CheckoutPage() {
  const slug = useTenantSlug();
  const router = useRouter();
  const { lines, total, clear } = useCart();

  const [step, setStep] = useState<Step>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<'CASH' | 'ONLINE'>('CASH');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delivery zone quote (by pincode).
  const [pincode, setPincode] = useState('');
  const [quote, setQuote] = useState<import('@/lib/client').DeliveryQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  async function checkPincode() {
    if (pincode.length < 4) return;
    setQuoteBusy(true); setError(null);
    try {
      const { getDeliveryQuote } = await import('@/lib/client');
      setQuote(await getDeliveryQuote(slug, pincode));
    } catch (e) { setError((e as Error).message); } finally { setQuoteBusy(false); }
  }

  const deliveryFee = quote?.deliverable ? quote.fee ?? 0 : 0;
  const grandTotal = Math.max(0, total - couponDiscount) + deliveryFee;

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponBusy(true); setCouponMsg(null);
    try {
      const { validateCoupon } = await import('@/lib/client');
      const r = await validateCoupon(slug, couponCode.trim(), total);
      if (r.valid) {
        setCouponDiscount(r.discount);
        setCouponMsg(`Applied: −₹${r.discount.toFixed(0)}`);
      } else {
        setCouponDiscount(0);
        setCouponMsg(r.message || 'Invalid coupon');
      }
    } catch (e) {
      setCouponMsg((e as Error).message);
    } finally {
      setCouponBusy(false);
    }
  }

  // Skip login if already authenticated.
  useEffect(() => {
    if (getCustomerToken()) {
      getMe()
        .then((me) => { setName(me.name || ''); setPhone(me.phone); setStep('details'); })
        .catch(() => { /* token invalid — stay on login */ });
    }
  }, []);

  async function sendCode() {
    setBusy(true); setError(null);
    try {
      const r = await requestOtp(phone);
      setDevCode(r.devCode ?? null);
      setStep('otp');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function confirmCode() {
    setBusy(true); setError(null);
    try {
      const r = await verifyOtp(phone, code);
      setCustomerToken(r.token);
      if (r.customer.name) setName(r.customer.name);
      setStep('details');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function submitOrder() {
    setBusy(true); setError(null);
    try {
      const payload: PlaceOrderPayload = {
        customer_name: name || undefined,
        customer_phone: phone || undefined,
        payment_method: payment,
        notes: notes || undefined,
        coupon_code: couponDiscount > 0 ? couponCode.trim() : undefined,
        items: lines.map((l) => ({
          menu_item_id: l.menu_item_id,
          quantity: l.quantity,
          special_instructions: l.special_instructions,
          modifiers: l.modifiers,
        })),
      };
      const result = await placeOrder(slug, payload);

      // Online payment → open Razorpay, verify, then track. If the gateway is
      // not configured, the order has no razorpay payload and we proceed as a
      // pending order (owner can collect/confirm).
      if (payment === 'ONLINE' && result.razorpay) {
        try {
          await payWithRazorpay(result, { name: slug, customerName: name, customerPhone: phone });
        } catch (e) {
          // Payment cancelled/failed — order exists but unpaid. Send to tracking
          // with a note rather than losing the order.
          setError(`Payment not completed: ${(e as Error).message}. Your order is saved as pending.`);
        }
      }

      clear();
      router.push(`/track/${encodeURIComponent(result.order_number)}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16 text-center">
        <p className="mb-4">Your cart is empty.</p>
        <a href="/menu" className="underline">Browse the menu</a>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>Checkout</h1>

      <div className="mb-6 space-y-2 rounded-xl border p-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal ({lines.length} items)</span>
          <span>₹{total.toFixed(0)}</span>
        </div>
        {couponDiscount > 0 ? (
          <div className="flex justify-between text-emerald-700">
            <span>Coupon discount</span>
            <span>−₹{couponDiscount.toFixed(0)}</span>
          </div>
        ) : null}
        {deliveryFee > 0 ? (
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>₹{deliveryFee.toFixed(0)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t pt-2 font-bold">
          <span>Total</span>
          <span style={{ color: 'var(--brand-accent)' }}>₹{grandTotal.toFixed(0)}</span>
        </div>

        {/* Coupon */}
        <div className="flex gap-2 pt-2">
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Coupon code"
            className="flex-1 rounded-lg border px-3 py-1.5 text-sm uppercase"
          />
          <button
            onClick={applyCoupon}
            disabled={couponBusy || !couponCode.trim()}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {couponBusy ? '…' : 'Apply'}
          </button>
        </div>
        {couponMsg ? (
          <p className={`text-xs ${couponDiscount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{couponMsg}</p>
        ) : null}
      </div>

      {error ? <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {step === 'login' ? (
        <div className="space-y-4">
          <label className="block text-sm font-medium">Mobile number</label>
          <input
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+9198XXXXXXXX" inputMode="tel"
            className="w-full rounded-lg border px-3 py-2"
          />
          <button onClick={sendCode} disabled={busy || phone.length < 8}
            className="w-full rounded-full px-6 py-3 font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}>
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
        </div>
      ) : null}

      {step === 'otp' ? (
        <div className="space-y-4">
          {devCode ? <p className="rounded bg-amber-50 p-2 text-xs">Dev code: <b>{devCode}</b></p> : null}
          <label className="block text-sm font-medium">Enter 6-digit code sent to {phone}</label>
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••" inputMode="numeric"
            className="w-full rounded-lg border px-3 py-2 tracking-widest"
          />
          <button onClick={confirmCode} disabled={busy || code.length !== 6}
            className="w-full rounded-full px-6 py-3 font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}>
            {busy ? 'Verifying…' : 'Verify & Continue'}
          </button>
          <button onClick={() => setStep('login')} className="w-full text-sm underline">Change number</button>
        </div>
      ) : null}

      {step === 'details' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Delivery pincode</label>
            <div className="mt-1 flex gap-2">
              <input value={pincode} onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '').slice(0, 6)); setQuote(null); }}
                inputMode="numeric" placeholder="e.g. 560034" className="w-full rounded-lg border px-3 py-2" />
              <button onClick={checkPincode} disabled={quoteBusy || pincode.length < 4}
                className="whitespace-nowrap rounded-lg border px-4 text-sm font-medium disabled:opacity-50">
                {quoteBusy ? '…' : 'Check'}
              </button>
            </div>
            {quote ? (
              quote.deliverable ? (
                <p className="mt-2 text-sm text-green-700">
                  Delivers to {quote.zone_name} · Fee ₹{(quote.fee ?? 0).toFixed(0)}
                  {quote.eta_minutes ? ` · ~${quote.eta_minutes} min` : ''}
                  {quote.min_order ? ` · Min order ₹${quote.min_order.toFixed(0)}` : ''}
                </p>
              ) : (
                <p className="mt-2 text-sm text-red-700">Sorry, we don’t deliver to this pincode.</p>
              )
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Payment</label>
            <div className="mt-2 flex gap-3">
              {(['CASH', 'ONLINE'] as const).map((m) => (
                <button key={m} onClick={() => setPayment(m)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                  style={payment === m ? { borderColor: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary)', color: '#fff' } : undefined}>
                  {m === 'CASH' ? 'Cash / COD' : 'Pay Online'}
                </button>
              ))}
            </div>
          </div>
          {deliveryFee > 0 ? (
            <div className="flex justify-between border-t pt-3 text-sm">
              <span>Items ₹{total.toFixed(0)} + Delivery ₹{deliveryFee.toFixed(0)}</span>
              <span className="font-bold">₹{grandTotal.toFixed(0)}</span>
            </div>
          ) : null}
          <button onClick={submitOrder} disabled={busy || (!!quote && !quote.deliverable)}
            className="w-full rounded-full px-6 py-3 font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}>
            {busy ? 'Placing order…' : `Place Order · ₹${grandTotal.toFixed(0)}`}
          </button>
          {payment === 'ONLINE' ? (
            <p className="text-center text-xs opacity-60">Online payment (Razorpay) completes on the next step.</p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
