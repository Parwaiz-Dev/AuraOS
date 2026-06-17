'use client';

import { useCart } from '@/lib/cart';

/** Cart link with live item-count badge for the header. */
export function CartLink() {
  const { count } = useCart();
  return (
    <a href="/cart" className="relative inline-flex items-center gap-1 opacity-90 hover:opacity-100">
      Cart
      {count > 0 ? (
        <span
          className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-gray-900"
          style={{ backgroundColor: 'var(--brand-secondary)' }}
        >
          {count}
        </span>
      ) : null}
    </a>
  );
}
