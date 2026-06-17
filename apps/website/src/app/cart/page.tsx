'use client';

import { useCart, lineTotal } from '@/lib/cart';

export default function CartPage() {
  const { lines, setQty, remove, total } = useCart();

  if (lines.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>
          Your cart is empty
        </h1>
        <a href="/menu" className="underline">Browse the menu</a>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        Your Cart
      </h1>

      <ul className="divide-y rounded-xl border">
        {lines.map((l) => (
          <li key={l.key} className="flex items-start justify-between gap-4 p-4">
            <div className="flex-1">
              <p className="font-medium">{l.name}</p>
              {l.modifiers.length > 0 ? (
                <p className="mt-1 text-xs opacity-60">
                  {l.modifiers.map((m) => m.modifier_option_name).join(', ')}
                </p>
              ) : null}
              <div className="mt-2 inline-flex items-center gap-2">
                <button onClick={() => setQty(l.key, l.quantity - 1)} className="h-7 w-7 rounded border text-lg leading-none">−</button>
                <span className="w-6 text-center">{l.quantity}</span>
                <button onClick={() => setQty(l.key, l.quantity + 1)} className="h-7 w-7 rounded border text-lg leading-none">+</button>
                <button onClick={() => remove(l.key)} className="ml-3 text-sm text-red-600 underline">Remove</button>
              </div>
            </div>
            <span className="whitespace-nowrap font-semibold" style={{ color: 'var(--brand-accent)' }}>
              ₹{lineTotal(l).toFixed(0)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between text-lg font-bold">
        <span>Total</span>
        <span style={{ color: 'var(--brand-accent)' }}>₹{total.toFixed(0)}</span>
      </div>

      <a
        href="/checkout"
        className="mt-6 block rounded-full px-6 py-3 text-center font-semibold text-white"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        Proceed to Checkout
      </a>
    </main>
  );
}
