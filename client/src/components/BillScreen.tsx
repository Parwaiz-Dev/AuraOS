/**
 * BillScreen — shown when a READY order is tapped.
 *
 * Displays a formatted bill with:
 *   - Restaurant name + GSTIN
 *   - Order number, table, date/time
 *   - Itemized list
 *   - Subtotal + CGST + SGST (or IGST for parcel/online) + Grand Total
 *
 * Two actions:
 *   [Print Bill]       — opens browser print dialog (thermal-friendly layout)
 *   [Collect Payment]  — opens the PaymentForm with grand total pre-filled
 */

import React, { useEffect, useState, useRef } from 'react'
import api, { getErrorMessage } from '../api'
import toast from 'react-hot-toast'
import { Order, OrderItem } from '../types/order'
import { formatDate } from '../lib/utils'
import Button from './Button'
import Loading from './Loading'
import PaymentForm from './PaymentForm'
import { PrinterIcon, CurrencyDollarIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface RestaurantInfo {
  name: string
  gstin: string | null
  tax_rate: number
  tax_inclusive: boolean
  qsr_enabled: boolean
  token_prefix: string
}

interface BillScreenProps {
  orderId: string
  tableNumber?: string
  onClose: () => void
  onCompleted: () => void
}

function calcTax(subtotal: number, taxRate: number, inclusive: boolean) {
  if (taxRate === 0) return { subtotal, taxAmount: 0, grandTotal: subtotal, cgst: 0, sgst: 0 }

  let base: number
  let taxAmount: number

  if (inclusive) {
    // Prices already include GST — back-calculate the base
    base = subtotal / (1 + taxRate / 100)
    taxAmount = subtotal - base
  } else {
    base = subtotal
    taxAmount = (subtotal * taxRate) / 100
  }

  const cgst = taxAmount / 2
  const sgst = taxAmount / 2
  const grandTotal = base + taxAmount

  return { subtotal: base, taxAmount, cgst, sgst, grandTotal }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)

const BillScreen: React.FC<BillScreenProps> = ({ orderId, tableNumber, onClose, onCompleted }) => {
  const printRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentOpen, setPaymentOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/orders/${orderId}`),
      api.get('/restaurants/me'),
    ])
      .then(([orderRes, restRes]) => {
        const data = orderRes.data.data
        const ord = data?.order ?? data
        setOrder(ord)
        setItems(ord?.items || ord?.order_items || data?.items || [])

        const r = restRes.data.data
        setRestaurant({
          name: r.name,
          gstin: r.gstin ?? null,
          tax_rate: Number(r.tax_rate ?? 5),
          tax_inclusive: Boolean(r.tax_inclusive),
          qsr_enabled: Boolean(r.qsr_enabled),
          token_prefix: r.token_prefix || 'T',
        })
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [orderId])

  const handlePrint = () => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    win.document.write(`
      <html><head><title>Bill</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 8px; }
        h1 { font-size: 16px; text-align: center; font-weight: bold; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .bold { font-weight: bold; }
        .total-row { font-size: 14px; font-weight: bold; }
        .tax-row { font-size: 11px; color: #555; }
        @media print { body { width: 80mm; } }
      </style>
      </head><body>${content}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <Loading text="Loading bill…" />
    </div>
  )

  if (!order || !restaurant) return null

  const rawSubtotal = items.reduce((s, i) => s + Number(i.unit_price || 0) * i.quantity, 0)
  const { subtotal, cgst, sgst, grandTotal } = calcTax(rawSubtotal, restaurant.tax_rate, restaurant.tax_inclusive)
  const isParcel = order.order_type !== 'DINE_IN'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pb-3 header-safe border-b border-gray-200 shrink-0">
        <h2 className="font-bold text-gray-900 text-lg">Bill</h2>
        <button type="button" title="Close" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Scrollable bill area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Printable content */}
        <div ref={printRef} className="max-w-sm mx-auto space-y-3 text-sm">
          {/* Restaurant header */}
          <div className="text-center space-y-0.5">
            <p className="text-xl font-bold text-gray-900">{restaurant.name}</p>
            {restaurant.gstin && (
              <p className="text-xs text-gray-500">GSTIN: {restaurant.gstin}</p>
            )}
            <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
          </div>

          <div className="border-t border-dashed border-gray-300" />

          {/* Order info */}
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Order #</span>
              <span className="font-medium text-gray-900">{order.order_number}</span>
            </div>
            {tableNumber && (
              <div className="flex justify-between">
                <span>Table</span>
                <span className="font-medium text-gray-900">{tableNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-medium text-gray-900">{order.order_type}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300" />

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {items.map((item, i) => {
              const lineTotal = Number(item.unit_price || 0) * item.quantity
              return (
                <div key={item.id || i}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900 flex-1 pr-2">
                      {item.menu_item_name || item.menu_item_id}
                    </span>
                    <span className="text-gray-900 shrink-0">{fmt(lineTotal)}</span>
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.modifiers.map((m, mi) => {
                        const adj = Number(m.price_adjustment || 0)
                        return (
                          <span key={mi}>
                            {mi > 0 && ', '}
                            {m.modifier_option_name}
                            {adj > 0 ? ` (+${fmt(adj)})` : adj < 0 ? ` (-${fmt(Math.abs(adj))})` : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {item.quantity} × {fmt(Number(item.unit_price || 0))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-dashed border-gray-300" />

          {/* Tax breakdown */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal{restaurant.tax_inclusive ? ' (incl. GST)' : ''}</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {restaurant.tax_rate > 0 && (
              <>
                {isParcel ? (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>IGST ({restaurant.tax_rate}%)</span>
                    <span>{fmt(cgst + sgst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-500 text-xs">
                      <span>CGST ({restaurant.tax_rate / 2}%)</span>
                      <span>{fmt(cgst)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-xs">
                      <span>SGST ({restaurant.tax_rate / 2}%)</span>
                      <span>{fmt(sgst)}</span>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base text-gray-900">
              <span>Grand Total</span>
              <span className="text-indigo-600">{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-gray-300 pt-2 text-center text-xs text-gray-400">
            <p>Thank you for dining with us!</p>
            {restaurant.gstin && <p className="mt-0.5">This is a computer generated bill</p>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pt-4 footer-safe border-t border-gray-200 grid grid-cols-2 gap-3 shrink-0">
        <Button
          variant="outline"
          fullWidth
          leftIcon={<PrinterIcon className="w-4 h-4" />}
          onClick={handlePrint}
        >
          Print Bill
        </Button>
        <Button
          variant="primary"
          fullWidth
          leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
          onClick={() => setPaymentOpen(true)}
        >
          Collect Payment
        </Button>
      </div>

      {/* Payment form */}
      {paymentOpen && (
        <PaymentForm
          orderId={orderId}
          onClose={() => setPaymentOpen(false)}
          onPaymentSuccess={() => {
            setPaymentOpen(false)
            toast.success('Payment recorded ✓')
            onCompleted()
          }}
        />
      )}
    </div>
  )
}

export default BillScreen
