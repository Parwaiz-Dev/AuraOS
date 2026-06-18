'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartModifier {
  modifier_group_id: string;
  modifier_group_name: string;
  modifier_option_id: string;
  modifier_option_name: string;
  price_adjustment: number;
}

export interface CartLine {
  key: string; // unique per item+modifier combination
  menu_item_id: string;
  name: string;
  base_price: number;
  quantity: number;
  modifiers: CartModifier[];
  special_instructions?: string;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'key' | 'quantity'>, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  total: number;
}

const CartContext = createContext<CartState | null>(null);

function lineKey(menuItemId: string, modifiers: CartModifier[]): string {
  const mods = [...modifiers].map((m) => m.modifier_option_id).sort().join(',');
  return `${menuItemId}|${mods}`;
}

function lineTotal(line: CartLine): number {
  const mod = line.modifiers.reduce((s, m) => s + m.price_adjustment, 0);
  return (line.base_price + mod) * line.quantity;
}

const STORAGE_KEY = 'auraos_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist — but ONLY after hydration, so the initial empty state can't
  // overwrite a saved cart before localStorage has been read (StrictMode race).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, hydrated]);

  const api = useMemo<CartState>(() => {
    const add: CartState['add'] = (line, qty = 1) => {
      const key = lineKey(line.menu_item_id, line.modifiers);
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + qty } : l));
        }
        return [...prev, { ...line, key, quantity: qty }];
      });
    };
    const setQty: CartState['setQty'] = (key, qty) =>
      setLines((prev) =>
        qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)),
      );
    const remove: CartState['remove'] = (key) => setLines((prev) => prev.filter((l) => l.key !== key));
    const clear = () => setLines([]);
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const total = lines.reduce((s, l) => s + lineTotal(l), 0);
    return { lines, add, setQty, remove, clear, count, total };
  }, [lines]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export { lineTotal };
