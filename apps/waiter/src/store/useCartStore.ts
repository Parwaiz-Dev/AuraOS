/**
 * Cart store — manages the current order being built.
 * Cleared after order is submitted.
 */

import { create } from 'zustand'
import type { CartLine, OrderType, OrderSource } from '../types'

interface CartState {
  tableId:      string | null
  tableNumber:  string | null
  orderType:    OrderType
  orderSource:  OrderSource
  notes:        string
  cart:         CartLine[]

  setTable:     (id: string | null, number: string | null) => void
  setOrderType: (type: OrderType) => void
  setNotes:     (notes: string) => void
  addItem:      (item: CartLine) => void
  removeItem:   (menuItemId: string) => void
  changeQty:    (menuItemId: string, delta: number) => void
  setNote:      (menuItemId: string, note: string) => void
  clear:        () => void

  total:        () => number
  count:        () => number
}

export const useCartStore = create<CartState>()((set, get) => ({
  tableId:     null,
  tableNumber: null,
  orderType:   'DINE_IN',
  orderSource: 'WAITER',
  notes:       '',
  cart:        [],

  setTable: (id, number) => set({ tableId: id, tableNumber: number }),
  setOrderType: (type) => set({ orderType: type }),
  setNotes: (notes) => set({ notes }),

  addItem: (item) => {
    set((state) => {
      const existing = state.cart.find(
        (c) => c.menu_item_id === item.menu_item_id && !c.special_instructions,
      )
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.menu_item_id === item.menu_item_id && !c.special_instructions
              ? { ...c, quantity: c.quantity + item.quantity }
              : c,
          ),
        }
      }
      return { cart: [...state.cart, item] }
    })
  },

  removeItem: (menuItemId) =>
    set((state) => ({ cart: state.cart.filter((c) => c.menu_item_id !== menuItemId) })),

  changeQty: (menuItemId, delta) =>
    set((state) => ({
      cart: state.cart
        .map((c) => (c.menu_item_id === menuItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    })),

  setNote: (menuItemId, note) =>
    set((state) => ({
      cart: state.cart.map((c) =>
        c.menu_item_id === menuItemId ? { ...c, special_instructions: note } : c,
      ),
    })),

  clear: () => set({ cart: [], tableId: null, tableNumber: null, notes: '' }),

  total: () => get().cart.reduce((s, c) => s + c.price * c.quantity, 0),
  count: () => get().cart.reduce((s, c) => s + c.quantity, 0),
}))
