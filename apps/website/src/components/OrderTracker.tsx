'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useTenantSlug } from '@/components/Providers';
import { trackOrder, type OrderStatus } from '@/lib/client';
import { SOCKET_URL } from '@/lib/config';

const STEPS = ['CREATED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'] as const;
const LABELS: Record<string, string> = {
  CREATED: 'Order Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function OrderTracker({ orderNumber }: { orderNumber: string }) {
  const slug = useTenantSlug();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch + polling fallback (in case sockets are unavailable).
  useEffect(() => {
    let active = true;
    const load = () => trackOrder(slug, orderNumber).then((o) => { if (active) setOrder(o); }).catch((e) => { if (active) setError((e as Error).message); });
    load();
    const poll = setInterval(load, 15000);
    return () => { active = false; clearInterval(poll); };
  }, [slug, orderNumber]);

  // Live updates via Socket.io — join the public order room.
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      socket.on('connect', () => socket?.emit('track_order', { orderNumber }));
      const onUpdate = (p: { status?: string }) => {
        if (p?.status) setOrder((prev) => (prev ? { ...prev, status: p.status as string } : prev));
      };
      socket.on('ORDER_UPDATED', onUpdate);
      socket.on('ORDER_COMPLETED', onUpdate);
      socket.on('ORDER_CANCELLED', onUpdate);
    } catch {
      /* sockets optional — polling covers it */
    }
    return () => { socket?.disconnect(); };
  }, [orderNumber]);

  if (error) {
    return <p className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  }
  if (!order) {
    return <p className="opacity-60">Loading order status…</p>;
  }

  const cancelled = order.status === 'CANCELLED';
  const currentIdx = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div>
      <div className="mb-6 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-60">Order</p>
            <p className="font-bold">{order.order_number}</p>
          </div>
          {order.token_number ? (
            <div className="text-right">
              <p className="text-sm opacity-60">Token</p>
              <p className="font-bold" style={{ color: 'var(--brand-accent)' }}>{order.token_number}</p>
            </div>
          ) : null}
        </div>
      </div>

      {cancelled ? (
        <p className="rounded-xl bg-red-50 p-4 text-center font-semibold text-red-700">This order was cancelled.</p>
      ) : (
        <ol className="space-y-3">
          {STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: done ? 'var(--brand-accent)' : '#d1d5db' }}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={active ? 'font-bold' : done ? 'opacity-80' : 'opacity-40'}>
                  {LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8 flex justify-between text-sm">
        <a href="/menu" className="underline">Order again</a>
        <span className="font-semibold" style={{ color: 'var(--brand-accent)' }}>₹{Number(order.total_amount).toFixed(0)}</span>
      </div>
    </div>
  );
}
