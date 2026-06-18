'use client';

import { CORE_API_URL } from './config';

/**
 * Browser-side API client for ordering, customer auth and tracking.
 * Server components use src/lib/api.ts; this is for interactive client flows.
 */

const TOKEN_KEY = 'auraos_customer_token';

export function getCustomerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setCustomerToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearCustomerToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) };
  if (init?.auth) {
    const token = getCustomerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${CORE_API_URL}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

// ── Customer auth ──────────────────────────────────────────────────────────────
export function requestOtp(phone: string) {
  return req<{ sent: boolean; devCode?: string }>('/customers/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}
export function verifyOtp(phone: string, code: string) {
  return req<{ token: string; customer: { id: string; phone: string; name: string | null } }>(
    '/customers/otp/verify',
    { method: 'POST', body: JSON.stringify({ phone, code }) },
  );
}
export function getMe() {
  return req<{ id: string; phone: string; name: string | null; email: string | null }>('/customers/me', { auth: true });
}

// ── Ordering ───────────────────────────────────────────────────────────────────
export interface PlaceOrderItem {
  menu_item_id: string;
  quantity: number;
  special_instructions?: string;
  modifiers?: Array<{
    modifier_group_id: string;
    modifier_group_name: string;
    modifier_option_id: string;
    modifier_option_name: string;
    price_adjustment: number;
  }>;
}
export interface PlaceOrderPayload {
  customer_name?: string;
  customer_phone?: string;
  payment_method?: 'CASH' | 'CARD' | 'UPI' | 'ONLINE';
  notes?: string;
  delivery_address_id?: string | null;
  coupon_code?: string;
  redeem_points?: number;
  items: PlaceOrderItem[];
}
export interface PlaceOrderResult {
  order_number: string;
  order_id: string;
  total_amount: number;
  status: string;
  items_count: number;
  payment_method: string;
  razorpay: { razorpay_order_id: string; amount: number; currency: string; key_id: string } | null;
}
export function placeOrder(slug: string, payload: PlaceOrderPayload) {
  return req<PlaceOrderResult>(`/public/order/${encodeURIComponent(slug)}`, {
    method: 'POST',
    auth: true, // optional token links the order to the customer
    body: JSON.stringify(payload),
  });
}

// ── Tracking ───────────────────────────────────────────────────────────────────
export interface OrderStatus {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  token_number: string | null;
  created_at: string;
  updated_at: string;
}
export function trackOrder(slug: string, orderNumber: string) {
  return req<OrderStatus>(`/public/site/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderNumber)}`);
}

// ── Payment verification (after Razorpay checkout) ─────────────────────────────
export function verifyPayment(payload: {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return req<{ verified: boolean; message: string }>('/public/verify-payment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Reservations ───────────────────────────────────────────────────────────────
export function createReservation(slug: string, payload: {
  customer_name: string;
  customer_phone: string;
  party_size: number;
  reserved_for: string; // ISO
  special_requests?: string;
}) {
  return req<{ id: string; status: string; reserved_for: string; party_size: number }>(
    `/public/site/${encodeURIComponent(slug)}/reservations`,
    { method: 'POST', auth: true, body: JSON.stringify(payload) },
  );
}

// ── Delivery quote ─────────────────────────────────────────────────────────────
export interface DeliveryQuote {
  deliverable: boolean;
  zone_name?: string;
  fee?: number;
  min_order?: number;
  eta_minutes?: number | null;
}
export function getDeliveryQuote(slug: string, pincode: string) {
  return req<DeliveryQuote>(
    `/public/site/${encodeURIComponent(slug)}/delivery-quote?pincode=${encodeURIComponent(pincode)}`,
  );
}

// ── Coupons ────────────────────────────────────────────────────────────────────
export interface CouponResult {
  valid: boolean;
  discount: number;
  code?: string;
  message?: string;
}
export function validateCoupon(slug: string, code: string, orderTotal: number) {
  return req<CouponResult>(`/public/site/${encodeURIComponent(slug)}/coupon/validate`, {
    method: 'POST',
    body: JSON.stringify({ code, order_total: orderTotal }),
  });
}

// ── Loyalty ────────────────────────────────────────────────────────────────────
export interface LoyaltyInfo {
  balance: number;
  ledger: Array<{ points: number; reason: string; created_at: string }>;
}
export function getLoyalty(slug: string) {
  return req<LoyaltyInfo>(`/customers/me/loyalty?slug=${encodeURIComponent(slug)}`, { auth: true });
}

// ── Reviews ────────────────────────────────────────────────────────────────────
export function submitReview(slug: string, payload: { rating: number; title?: string; body?: string }) {
  return req<{ id: string }>(`/customers/me/reviews`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ slug, ...payload }),
  });
}
