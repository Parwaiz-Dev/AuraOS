'use client';

import { useState } from 'react';
import { useCart, type CartModifier } from '@/lib/cart';

/**
 * Add-to-cart button for a menu item. Modifier selection UI is intentionally
 * minimal here (Phase 2 baseline) — it adds the item with any pre-resolved
 * modifiers. Full modifier pickers come with the dedicated item dialog later.
 */
export function AddToCart({
  menuItemId,
  name,
  price,
  modifiers = [],
}: {
  menuItemId: string;
  name: string;
  price: number;
  modifiers?: CartModifier[];
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    add({ menu_item_id: menuItemId, name, base_price: price, modifiers });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="rounded-full px-4 py-1.5 text-sm font-semibold text-white transition"
      style={{ backgroundColor: added ? '#16a34a' : 'var(--brand-primary)' }}
    >
      {added ? 'Added ✓' : 'Add'}
    </button>
  );
}
