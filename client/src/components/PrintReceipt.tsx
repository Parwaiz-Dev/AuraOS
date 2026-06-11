/**
 * PrintReceipt — Customer Bill / Receipt
 *
 * Prints a customer-facing receipt showing:
 *   - Restaurant name
 *   - Order number, table, date
 *   - Itemised list with prices
 *   - Subtotal, tax (18% GST), total
 *   - Payment method
 *   - Thank you message
 *
 * Designed for 80mm thermal printers.
 * Also works as an A4 receipt for non-thermal printers.
 *
 * Usage:
 *   printReceipt(order, items, restaurantName, paymentMethod)
 */

import React from 'react'
import { Order, OrderItem } from '../types/order'
import { formatDate } from '../lib/utils'

interface PrintReceiptProps {
  order: Order
  items: OrderItem[]
  restaurantName?: string
  paymentMethod?: string
  onClose: () => void
}

function formatRupees(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`
}

/**
 * Programmatically print a receipt without showing a preview modal.
 * Note: This shows the order total as-is. For proper tax breakdown
 * (CGST/SGST based on restaurant settings), use BillScreen.
 */
export function printReceipt(
  order: Order,
  items: OrderItem[],
  restaurantName = 'Restaurant',
  paymentMethod = 'CASH',
): void {
  const win = window.open('', '_blank', 'width=400,height=700')
  if (!win) return

  const total = Number(order.total_amount || 0)

  const fmtMods = (mods?: any[]) =>
    mods && mods.length > 0
      ? `<div style="font-size:10px;color:#555;margin-top:1px;">${mods
          .map((m) => {
            const adj = Number(m.price_adjustment || 0)
            return `${m.modifier_option_name}${adj > 0 ? ` (+${adj})` : adj < 0 ? ` (${adj})` : ''}`
          })
          .join(', ')}</div>`
      : ''

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:3px 0;">
          ${item.menu_item_name || item.menu_item_id}
          ${fmtMods(item.modifiers)}
        </td>
        <td style="text-align:center;padding:3px 4px;">${item.quantity}</td>
        <td style="text-align:right;padding:3px 0;">${formatRupees(Number(item.unit_price || 0))}</td>
        <td style="text-align:right;padding:3px 0;">${formatRupees(Number(item.unit_price || 0) * item.quantity)}</td>
      </tr>`,
    )
    .join('')

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt — ${order.order_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #000;
          background: #fff;
          padding: 8px;
          width: 80mm;
        }
        .center { text-align: center; }
        .right  { text-align: right; }
        .bold   { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 5px 0; }
        .divider-solid { border-top: 1px solid #000; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { font-size: 10px; text-transform: uppercase; padding: 2px 0; }
        .total-row td { font-weight: bold; font-size: 14px; padding-top: 4px; }
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="bold" style="font-size:16px;">${restaurantName}</div>
        <div style="font-size:10px;margin-top:2px;">BILL / RECEIPT</div>
      </div>
      <div class="divider"></div>

      <table>
        <tr>
          <td>Order #</td>
          <td class="right bold">${order.order_number}</td>
        </tr>
        ${order.table?.table_number ? `<tr><td>Table</td><td class="right">${order.table.table_number}</td></tr>` : ''}
        <tr>
          <td>Type</td>
          <td class="right">${order.order_type}</td>
        </tr>
        <tr>
          <td>Date</td>
          <td class="right">${formatDate(order.created_at)}</td>
        </tr>
        <tr>
          <td>Payment</td>
          <td class="right">${paymentMethod}</td>
        </tr>
      </table>

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Rate</th>
            <th style="text-align:right;">Amt</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="divider-solid"></div>

      <table>
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="right">${formatRupees(total)}</td>
        </tr>
      </table>

      <div class="divider"></div>

      <div class="center" style="font-size:11px;">
        <div>Thank you for dining with us!</div>
        <div style="margin-top:4px;color:#555;font-size:10px;">
          Powered by AuraOS
        </div>
        <div style="margin-top:2px;color:#777;font-size:10px;">
          ${new Date().toLocaleString('en-IN')}
        </div>
      </div>
    </body>
    </html>
  `)

  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}

/**
 * Receipt preview modal.
 */
const PrintReceipt: React.FC<PrintReceiptProps> = ({
  order, items, restaurantName = 'Restaurant', paymentMethod = 'CASH', onClose,
}) => {
  const total = Number(order.total_amount || 0)

  const fmt = (n: number) => `₹${n.toFixed(2)}`

  const handlePrint = () => {
    printReceipt(order, items, restaurantName, paymentMethod)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs animate-slide-up">
        {/* Preview */}
        <div className="p-5 font-mono text-xs border-b border-gray-100 max-h-[70vh] overflow-y-auto">
          <div className="text-center mb-3">
            <p className="font-bold text-base">{restaurantName}</p>
            <p className="text-gray-400 text-xs">BILL / RECEIPT</p>
          </div>
          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-1 text-xs mb-2">
            <div className="flex justify-between"><span>Order #</span><span className="font-bold">{order.order_number}</span></div>
            {order.table?.table_number && <div className="flex justify-between"><span>Table</span><span>{order.table.table_number}</span></div>}
            <div className="flex justify-between"><span>Date</span><span>{formatDate(order.created_at)}</span></div>
            <div className="flex justify-between"><span>Payment</span><span>{paymentMethod}</span></div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left py-1">Item</th>
                <th className="text-center py-1">Qty</th>
                <th className="text-right py-1">Amt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-0.5">
                    <div>{item.menu_item_name || item.menu_item_id}</div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-gray-500 text-xs mt-0.5">
                        {item.modifiers.map((m) => {
                          const adj = Number(m.price_adjustment || 0)
                          return `${m.modifier_option_name}${adj > 0 ? ` (+₹${adj})` : adj < 0 ? ` (-₹${Math.abs(adj)})` : ''}`
                        }).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="text-center py-0.5">{item.quantity}</td>
                  <td className="text-right py-0.5">{fmt(Number(item.unit_price || 0) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-gray-300 my-2" />
          <div className="space-y-1 text-xs">
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span><span>{fmt(total)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />
          <p className="text-center text-gray-400 text-xs">Thank you for dining with us!</p>
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            🖨️ Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintReceipt
