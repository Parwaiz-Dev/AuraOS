/**
 * Order store — manages active orders and the offline queue.
 *
 * OFFLINE QUEUE
 * ─────────────
 * When the device has no internet, orders are saved to localStorage.
 * When connectivity is restored, the queue is drained automatically.
 *
 * IDEMPOTENCY
 * ───────────
 * Each order gets a unique idempotency_key (UUID) before being sent.
 * If the request times out and is retried, the backend ignores the duplicate.
 * (The backend currently accepts the key as a header — future: enforce uniqueness in DB)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ordersApi, CreateOrderPayload } from '../api/endpoints'
import type { Order, QueuedOrder } from '../types'

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

interface OrderState {
  orders:       Order[]
  queue:        QueuedOrder[]   // offline queue
  isLoading:    boolean

  fetchOrders:  () => Promise<void>
  submitOrder:  (payload: Omit<CreateOrderPayload, 'idempotency_key'>) => Promise<Order | null>
  drainQueue:   () => Promise<void>
  updateStatus: (id: string, status: string) => Promise<void>
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders:    [],
      queue:     [],
      isLoading: false,

      fetchOrders: async () => {
        set({ isLoading: true })
        try {
          const res = await ordersApi.list({ limit: 50 })
          set({ orders: res.data.data || [], isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      submitOrder: async (payload) => {
        const idempotency_key = uuid()
        const fullPayload: CreateOrderPayload = { ...payload, idempotency_key }

        try {
          const res = await ordersApi.create(fullPayload)
          const order = res.data.data.order
          set((state) => ({ orders: [order, ...state.orders] }))
          return order
        } catch (err: any) {
          // Network error — queue for later
          if (!err.response) {
            const queued: QueuedOrder = {
              id: uuid(),
              idempotency_key,
              payload,
              created_at: new Date().toISOString(),
              retries: 0,
            }
            set((state) => ({ queue: [...state.queue, queued] }))
            console.log('[OfflineQueue] Order queued:', queued.id)
            return null
          }
          throw err
        }
      },

      drainQueue: async () => {
        const { queue } = get()
        if (queue.length === 0) return

        console.log(`[OfflineQueue] Draining ${queue.length} queued order(s)`)

        for (const item of queue) {
          try {
            const res = await ordersApi.create({
              ...item.payload,
              idempotency_key: item.idempotency_key,
            })
            const order = res.data.data.order
            set((state) => ({
              orders: [order, ...state.orders],
              queue:  state.queue.filter((q) => q.id !== item.id),
            }))
            console.log(`[OfflineQueue] ✅ Synced order ${item.id}`)
          } catch (err: any) {
            if (!err.response) break // still offline — stop trying
            // Server error — increment retries, remove after 3 failures
            set((state) => ({
              queue: state.queue
                .map((q) => (q.id === item.id ? { ...q, retries: q.retries + 1 } : q))
                .filter((q) => q.retries < 3),
            }))
          }
        }
      },

      updateStatus: async (id, status) => {
        await ordersApi.updateStatus(id, status)
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, status: status as any } : o)),
        }))
      },
    }),
    {
      name: 'waiter-orders',
      partialize: (state) => ({ queue: state.queue }),
    },
  ),
)
