/**
 * MyOrdersPage — shows today's active orders.
 *
 * READY orders appear in a dedicated "Awaiting Payment" section with a single
 * [Collect Payment] action. One tap opens an inline payment sheet.
 * After full payment the order moves to COMPLETED and disappears from the list.
 *
 * Kitchen stages (CREATED → ACCEPTED → PREPARING) still have the advance button.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, ArrowRightIcon, CurrencyDollarIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useOrderStore } from '../store/useOrderStore'
import { ordersApi, paymentsApi, PaymentMethod } from '../api/endpoints'
import { formatDistanceToNow } from 'date-fns'
import type { Order, OrderStatus } from '../types'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n)

const STATUS_COLOR: Record<OrderStatus, string> = {
  CREATED:   'bg-gray-100 text-gray-700',
  ACCEPTED:  'bg-blue-100 text-blue-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY:     'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

// Only kitchen stages get the advance button; READY is handled via payment
const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  CREATED:   { next: 'ACCEPTED',  label: 'Accept' },
  ACCEPTED:  { next: 'PREPARING', label: 'Start Prep' },
  PREPARING: { next: 'READY',     label: 'Mark Ready' },
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'ONLINE']

// ── Inline payment sheet ────────────────────────────────────────────────────

interface PaymentSheetProps {
  order: Order
  onClose: () => void
  onPaid: () => void
}

const PaymentSheet: React.FC<PaymentSheetProps> = ({ order, onClose, onPaid }) => {
  const total = Number(order.total_amount || 0)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [amount, setAmount] = useState(total)
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  const handlePay = async () => {
    if (amount <= 0) { toast.error('Enter a valid amount'); return }
    if ((method === 'CARD' || method === 'UPI' || method === 'ONLINE') && !reference) {
      toast.error('Reference / transaction ID required'); return
    }
    setSaving(true)
    try {
      await paymentsApi.create({
        order_id: order.id,
        amount,
        method,
        status: 'PAID',
        reference_number: reference || undefined,
      })
      // Mark order COMPLETED after full payment
      if (amount >= total) {
        try { await ordersApi.updateStatus(order.id, 'COMPLETED') } catch { /* already completed by backend */ }
      }
      toast.success('Payment recorded ✓')
      onPaid()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Payment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl p-5 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900 text-lg">Collect Payment</p>
            <p className="text-sm text-gray-500">{order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Total */}
        <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-indigo-700">Total due</span>
          <span className="text-2xl font-bold text-indigo-700">{formatCurrency(total)}</span>
        </div>

        {/* Amount input */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Amount collected</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
            <input
              type="number"
              step="0.01"
              min={0.01}
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="input pl-7 text-lg font-bold"
            />
          </div>
        </div>

        {/* Method */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">Payment method</label>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                  method === m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Reference for non-cash */}
        {method !== 'CASH' && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Transaction / Reference ID{method === 'CARD' ? ' *' : ''}
            </label>
            <input
              type="text"
              placeholder="e.g. TXN123456"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="input text-sm"
            />
          </div>
        )}

        {/* Confirm */}
        <button
          onClick={handlePay}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base font-semibold"
        >
          {saving ? (
            <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <CurrencyDollarIcon className="w-5 h-5" />
          )}
          {saving ? 'Recording…' : `Confirm — ${formatCurrency(amount)}`}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate()
  const { orders, queue, isLoading, fetchOrders, updateStatus } = useOrderStore()
  const [payingOrder, setPayingOrder] = useState<Order | null>(null)

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const kitchenOrders = orders.filter(
    (o) => ['CREATED', 'ACCEPTED', 'PREPARING'].includes(o.status)
  )
  const readyOrders = orders.filter((o) => o.status === 'READY')

  const handleAdvance = async (order: Order) => {
    const action = NEXT_STATUS[order.status]
    if (!action) return
    try {
      await updateStatus(order.id, action.next)
      toast.success(`Order ${action.next.toLowerCase()}`)
    } catch {
      toast.error('Failed to update order')
    }
  }

  const handlePaid = () => {
    setPayingOrder(null)
    fetchOrders()
  }

  const totalActive = kitchenOrders.length + readyOrders.length

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">{totalActive} active</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Offline queue banner */}
      {queue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <span className="text-amber-500 text-xl">📶</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {queue.length} order{queue.length > 1 ? 's' : ''} queued offline
            </p>
            <p className="text-xs text-amber-600">Will sync when back online</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
        </div>
      ) : totalActive === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-semibold text-gray-900">No active orders</p>
          <p className="text-sm text-gray-500 mt-1">Tap "New" to take an order</p>
        </div>
      ) : (
        <>
          {/* Awaiting Payment section */}
          {readyOrders.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Awaiting Payment ({readyOrders.length})
              </h2>
              {readyOrders.map((order) => {
                const itemCount = (order.order_items || order.items || []).length
                return (
                  <div key={order.id} className="card p-4 space-y-3 border-l-4 border-l-emerald-400">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{order.order_number}</p>
                        <p className="text-xs text-gray-500">
                          {order.table?.table_number ? `Table ${order.table.table_number}` : order.order_type}
                          {' · '}
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR['READY']}`}>
                        Ready to pay
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                      <span className="font-bold text-gray-900 text-lg">{formatCurrency(Number(order.total_amount))}</span>
                    </div>
                    <button
                      onClick={() => setPayingOrder(order)}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                    >
                      <CurrencyDollarIcon className="w-5 h-5" />
                      Collect Payment
                    </button>
                  </div>
                )
              })}
            </section>
          )}

          {/* Active kitchen orders */}
          {kitchenOrders.length > 0 && (
            <section className="space-y-3">
              {readyOrders.length > 0 && (
                <h2 className="text-sm font-semibold text-gray-500">In Kitchen ({kitchenOrders.length})</h2>
              )}
              {kitchenOrders.map((order) => {
                const action = NEXT_STATUS[order.status]
                const itemCount = (order.order_items || order.items || []).length
                return (
                  <div key={order.id} className="card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{order.order_number}</p>
                        <p className="text-xs text-gray-500">
                          {order.table?.table_number ? `Table ${order.table.table_number}` : order.order_type}
                          {' · '}
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                      <span className="font-bold text-gray-900">{formatCurrency(Number(order.total_amount))}</span>
                    </div>
                    <div className="flex gap-2">
                      {action && (
                        <button
                          onClick={() => handleAdvance(order)}
                          className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm"
                        >
                          {action.label}
                          <ArrowRightIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/order/add/${order.id}?table=${order.table?.table_number || ''}`)}
                        className="btn-secondary flex items-center gap-1.5 py-2.5 px-3 text-sm"
                        title="Add more items"
                      >
                        <PlusIcon className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}

      {/* Inline payment sheet */}
      {payingOrder && (
        <PaymentSheet
          order={payingOrder}
          onClose={() => setPayingOrder(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  )
}

export default MyOrdersPage
