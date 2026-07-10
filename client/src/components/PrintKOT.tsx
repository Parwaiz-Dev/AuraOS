/**
 * PrintKOT — Kitchen Order Ticket
 *
 * Prints a ticket for the kitchen showing:
 *   - Order number (large, easy to read)
 *   - Table / order type
 *   - Each item with quantity and special instructions
 *   - Timestamp
 *
 * Designed for 80mm thermal printers (standard kitchen printers).
 * Uses browser's native window.print() — no external library needed.
 *
 * Usage:
 *   <PrintKOT order={order} items={items} onClose={() => {}} />
 *
 * Or call printKOT(order, items) directly to print without showing a modal.
 */

import React from 'react'
import { Order, OrderItem } from '../types/order'
import { formatDate } from '../lib/utils'

function esc(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface PrintKOTProps {
  order: Order
  items: OrderItem[]
  restaurantName?: string
  onClose: () => void
}

/**
 * Programmatically print a KOT without showing a preview modal.
 * Opens a new window, writes the HTML, triggers print, closes.
 */
export function printKOT(order: Order, items: OrderItem[], restaurantName = 'Kitchen'): void {
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return

  const fmtMods = (mods?: any[]) =>
    mods && mods.length > 0
      ? `<div style="font-size:11px;font-weight:normal;color:#555;margin-top:2px;">${mods
          .map((m) => {
            const adj = Number(m.price_adjustment || 0)
            return `${esc(m.modifier_option_name)}${adj > 0 ? ` (+${adj})` : adj < 0 ? ` (${adj})` : ''}`
          })
          .join(', ')}</div>`
      : ''

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="font-size:16px;font-weight:bold;padding:2px 0;">${item.quantity}x</td>
        <td style="padding:2px 4px;font-size:14px;font-weight:bold;">
          ${esc(item.menu_item_name || item.menu_item_id)}
          ${fmtMods(item.modifiers)}
          ${item.special_instructions
            ? `<div style="font-size:11px;font-weight:normal;color:#555;margin-top:2px;">📝 ${esc(item.special_instructions)}</div>`
            : ''}
        </td>
      </tr>`,
    )
    .join('')

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>KOT — ${esc(order.order_number)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: #000;
          background: #fff;
          padding: 8px;
          width: 80mm;
        }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .order-num { font-size: 28px; font-weight: bold; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; }
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;">${esc(restaurantName)}</div>
        <div style="font-size:11px;">KITCHEN ORDER TICKET</div>
      </div>
      <div class="divider"></div>

      <div class="center">
        <div class="order-num">${esc(order.order_number)}</div>
        <div style="font-size:12px;margin-top:2px;">
          ${order.table?.table_number ? `TABLE ${esc(String(order.table.table_number))}` : esc(order.order_type)}
          &nbsp;·&nbsp;
          ${esc(order.order_source)}
        </div>
        <div style="font-size:11px;color:#555;">${formatDate(order.created_at)}</div>
      </div>

      <div class="divider"></div>

      <table>
        <tbody>${itemRows}</tbody>
      </table>

      ${order.special_instructions ? `
        <div class="divider"></div>
        <div style="font-size:11px;">
          <strong>NOTE:</strong> ${esc(order.special_instructions)}
        </div>
      ` : ''}

      <div class="divider"></div>
      <div class="center" style="font-size:10px;color:#777;">
        ${new Date().toLocaleTimeString('en-IN')}
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
 * KOT preview modal — shows the ticket before printing.
 * Useful for verifying before sending to printer.
 */
const PrintKOT: React.FC<PrintKOTProps> = ({ order, items, restaurantName = 'Kitchen', onClose }) => {
  const handlePrint = () => {
    printKOT(order, items, restaurantName)
    onClose()
  }

  const fmtMods = (mods?: any[]) =>
    mods && mods.length > 0
      ? mods.map((m) => {
          const adj = Number(m.price_adjustment || 0)
          return `${m.modifier_option_name}${adj > 0 ? ` (+₹${adj})` : adj < 0 ? ` (-₹${Math.abs(adj)})` : ''}`
        }).join(', ')
      : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs animate-slide-up">
        {/* Preview */}
        <div className="p-5 font-mono text-xs border-b border-gray-100">
          <div className="text-center mb-3">
            <p className="text-xs uppercase tracking-widest text-gray-500">{restaurantName}</p>
            <p className="text-xs uppercase tracking-widest text-gray-400">Kitchen Order Ticket</p>
          </div>
          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="text-center mb-3">
            <p className="text-3xl font-bold tracking-wider">{order.order_number}</p>
            <p className="text-xs text-gray-500 mt-1">
              {order.table?.table_number ? `Table ${order.table.table_number}` : order.order_type}
              {' · '}{order.order_source}
            </p>
          </div>
          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i}>
                <div className="flex gap-2">
                  <span className="font-bold w-6 shrink-0">{item.quantity}x</span>
                  <span className="font-bold">{item.menu_item_name || item.menu_item_id}</span>
                </div>
                {fmtMods(item.modifiers) && (
                  <p className="text-gray-500 ml-8 text-xs">{fmtMods(item.modifiers)}</p>
                )}
                {item.special_instructions && (
                  <p className="text-gray-500 ml-8 text-xs">📝 {item.special_instructions}</p>
                )}
              </div>
            ))}
          </div>
          {order.special_instructions && (
            <>
              <div className="border-t border-dashed border-gray-300 my-2" />
              <p className="text-xs"><strong>NOTE:</strong> {order.special_instructions}</p>
            </>
          )}
          <div className="border-t border-dashed border-gray-300 my-2" />
          <p className="text-center text-gray-400 text-xs">{new Date().toLocaleTimeString('en-IN')}</p>
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            🖨️ Print KOT
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

export default PrintKOT
