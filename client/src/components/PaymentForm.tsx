import React, { useState, useEffect } from 'react'
import api, { getErrorMessage } from '../api'
import { Payment, PaymentStatus, PaymentMethod } from '../types/payment'
import { Order } from '../types/order'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import { formatCurrency } from '../lib/utils'
import toast from 'react-hot-toast'

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'ONLINE']
const STATUSES: PaymentStatus[] = ['PENDING', 'PAID', 'REFUNDED']

interface PaymentFormProps {
  orderId: string // empty string = let user pick
  onClose: () => void
  onPaymentSuccess: (payment: Payment) => void
}

const PaymentForm: React.FC<PaymentFormProps> = ({ orderId: initialOrderId, onClose, onPaymentSuccess }) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId)
  const [orderTotal, setOrderTotal] = useState(0)
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [status, setStatus] = useState<PaymentStatus>('PAID')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [_loadingOrders, setLoadingOrders] = useState(!initialOrderId)

  // Fetch active orders if no orderId provided
  useEffect(() => {
    if (!initialOrderId) {
      api.get('/orders', { params: { limit: 100 } })
        .then((res) => {
          const active = (res.data.data || []).filter(
            (o: Order) => !['COMPLETED', 'CANCELLED'].includes(o.status)
          )
          setOrders(active)
        })
        .catch((err) => toast.error(getErrorMessage(err)))
        .finally(() => setLoadingOrders(false))
    }
  }, [initialOrderId])

  // When an order is selected, load its total AND existing paid amount
  useEffect(() => {
    if (!selectedOrderId) return
    let cancelled = false

    Promise.all([
      api.get(`/orders/${selectedOrderId}`),
      api.get('/payments', { params: { limit: 500 } }),
    ]).then(([orderRes, paymentsRes]) => {
      if (cancelled) return
      const ord = orderRes.data.data?.order ?? orderRes.data.data
      const total = Number(ord?.total_amount || 0)
      setOrderTotal(total)

      // Sum PAID payments for this order
      const allPayments: Payment[] = paymentsRes.data.data || []
      const paid = allPayments
        .filter((p) => p.order_id === selectedOrderId && p.status === 'PAID')
        .reduce((s, p) => s + Number(p.amount), 0)
      setAlreadyPaid(paid)

      // Pre-fill with the remaining balance
      const balance = Math.max(0, total - paid)
      setAmount(balance)
    }).catch((err) => toast.error(getErrorMessage(err)))

    return () => { cancelled = true }
  }, [selectedOrderId])

  const balance = Math.max(0, orderTotal - alreadyPaid)
  const isFullyPaid = orderTotal > 0 && alreadyPaid >= orderTotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderId) { toast.error('Please select an order'); return }
    if (amount <= 0) { toast.error('Amount must be greater than 0'); return }
    if (isFullyPaid) { toast.error('This order is already fully paid'); return }
    if (method === 'CARD' && !reference) { toast.error('Reference number required for card payments'); return }

    setSaving(true)
    try {
      const res = await api.post('/payments', {
        order_id: selectedOrderId,
        amount,
        method,
        status,
        reference_number: reference || undefined,
      })
      const payment = res.data.data

      // Auto-complete the order if this payment covers the full balance
      const newPaid = alreadyPaid + amount
      if (newPaid >= orderTotal && orderTotal > 0) {
        try {
          await api.patch(`/orders/${selectedOrderId}`, { status: 'COMPLETED' })
        } catch {
          // Order may already be COMPLETED by the backend's atomic payment logic — ignore
        }
      }

      onPaymentSuccess(payment)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record Payment"
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button type="submit" form="payment-form" variant="primary" fullWidth isLoading={saving} disabled={isFullyPaid}>
            Record Payment
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Order selector */}
        {!initialOrderId ? (
          <div>
            <label className="form-label">Order <span className="text-red-500">*</span></label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="form-select w-full"
              required
            >
              <option value="">Select an order…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {formatCurrency(Number(o.total_amount))}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 border border-slate-200">
            <div className="flex justify-between">
              <span>Order total</span>
              <span className="font-semibold text-slate-900">{formatCurrency(orderTotal)}</span>
            </div>
            {alreadyPaid > 0 && (
              <div className="flex justify-between mt-1 text-emerald-700">
                <span>Already paid</span>
                <span className="font-semibold">− {formatCurrency(alreadyPaid)}</span>
              </div>
            )}
            {orderTotal > 0 && (
              <div className="flex justify-between mt-1 pt-1 border-t border-slate-200 font-semibold">
                <span className={balance === 0 ? 'text-emerald-700' : 'text-slate-900'}>
                  {balance === 0 ? '✓ Fully paid' : 'Balance due'}
                </span>
                <span className={balance === 0 ? 'text-emerald-700' : 'text-slate-900'}>
                  {formatCurrency(balance)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Already fully paid — block the form */}
        {isFullyPaid ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-emerald-700 font-semibold text-sm">✓ This order is already fully paid</p>
            <p className="text-emerald-600 text-xs mt-1">No further payment is needed.</p>
          </div>
        ) : (
          <>
            <Input
              label={`Amount${balance > 0 ? ` (balance: ${formatCurrency(balance)})` : ''}`}
              type="number"
              step="0.01"
              min={0.01}
              max={balance > 0 ? balance : undefined}
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              leftIcon={<span className="text-slate-400 text-sm">₹</span>}
              required
              fullWidth
            />

            <div>
              <label className="form-label">Payment Method</label>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      method === m
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Status</label>
              <div className="grid grid-cols-3 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      status === s
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {(method === 'CARD' || method === 'ONLINE' || method === 'UPI') && (
              <Input
                label={`Reference / Transaction ID${method === 'CARD' ? ' *' : ''}`}
                placeholder="e.g. TXN123456"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required={method === 'CARD'}
                fullWidth
              />
            )}
          </>
        )}
      </form>
    </Modal>
  )
}

export default PaymentForm
