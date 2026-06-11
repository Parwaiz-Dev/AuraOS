import { useEffect, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { useSocket } from '../contexts/SocketContext'
import { Order, OrderStatus } from '../types/order'
import { ClockIcon, CheckCircleIcon, WifiIcon, ExclamationCircleIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { formatElapsed } from '../lib/utils'
import { printKOT } from '../components/PrintKOT'

type SortBy = 'time' | 'priority'

interface OrderWithItems extends Order {
  items?: Array<{
    id?: string
    menu_item_id: string
    menu_item_name?: string
    quantity: number
    special_instructions?: string
    status?: 'PENDING' | 'PREPARING' | 'DONE'
  }>
  order_items?: Array<{
    id?: string
    menu_item_id: string
    menu_item_name?: string
    quantity: number
    special_instructions?: string
    status?: 'PENDING' | 'PREPARING' | 'DONE'
  }>
}

const CARD_COLORS: Record<string, string> = {
  CREATED:   'border-gray-500 bg-gray-900',
  PREPARING: 'border-amber-400 bg-amber-950',
  READY:     'border-emerald-400 bg-emerald-950',
  ACCEPTED:  'border-blue-400 bg-blue-950',
}

const Kitchen: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('time')
  // Track delayed order IDs so we can highlight them on the card
  const [delayedOrderIds, setDelayedOrderIds] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement>(null)
  const { on, off, isConnected } = useSocket()

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders', { params: { limit: 100 } })
      const all: OrderWithItems[] = res.data.data || []
      // Kitchen only shows pre-service stages. READY orders leave the kitchen display
      // immediately — waiter handles payment from the Orders / Tables screen.
      setOrders(all.filter((o) => ['CREATED', 'ACCEPTED', 'PREPARING'].includes(o.status)))
    } catch (err) {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Tick every second for elapsed timers — forces re-render for live timers
  useEffect(() => {
    const t = setInterval(() => {}, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const refresh = () => { playSound(); fetchOrders() }
    on('ORDER_CREATED', refresh)
    on('ORDER_UPDATED', fetchOrders)
    // When an order is delayed, add it to the highlighted set and show a toast
    on('ORDER_DELAYED', (data: { order_id: string; order_number: string; minutes_elapsed: number; threshold_minutes: number }) => {
      setDelayedOrderIds((prev) => new Set([...prev, data.order_id]))
      toast.error(
        `⚠️ Order ${data.order_number} delayed — ${data.minutes_elapsed}m (threshold: ${data.threshold_minutes}m)`,
        { duration: 8000, id: `delay-${data.order_id}` }
      )
    })
    // When an order is completed/cancelled, remove from delayed set
    on('ORDER_COMPLETED', (data: { order_id: string }) => {
      setDelayedOrderIds((prev) => { const s = new Set(prev); s.delete(data.order_id); return s })
    })
    on('ORDER_CANCELLED', (data: { order_id: string }) => {
      setDelayedOrderIds((prev) => { const s = new Set(prev); s.delete(data.order_id); return s })
    })
    return () => {
      off('ORDER_CREATED')
      off('ORDER_UPDATED')
      off('ORDER_DELAYED')
      off('ORDER_COMPLETED')
      off('ORDER_CANCELLED')
    }
  }, [on, off, fetchOrders])

  const playSound = () => {
    audioRef.current?.play().catch(() => {})
  }

  const updateStatus = async (id: string, status: OrderStatus) => {
    if (busy) return
    setBusy(true)
    try {
      await api.patch(`/orders/${id}`, { status })
      setOrders((p) =>
        status === 'COMPLETED' || status === 'CANCELLED'
          ? p.filter((o) => o.id !== id)
          : p.map((o) => (o.id === id ? { ...o, status } : o))
      )
      if (status === 'COMPLETED') toast.success('Order completed!', { icon: '✅' })
    } catch (err) {
      toast.error('Failed to update order')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Mark a single item as DONE (or toggle back to PENDING).
   * If all items are done, the backend auto-advances the order to READY.
   */
  const toggleItemDone = async (orderId: string, itemId: string, currentStatus: string) => {
    if (busy) return
    setBusy(true)
    const newStatus = currentStatus === 'DONE' ? 'PENDING' : 'DONE'
    try {
      const res = await api.patch(`/orders/${orderId}/items/${itemId}`, { status: newStatus })
      const { order_auto_advanced } = res.data.data

      // Update item status in local state
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o
          const updateItems = (arr: any[]) =>
            arr.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
          return {
            ...o,
            items: o.items ? updateItems(o.items) : o.items,
            order_items: o.order_items ? updateItems(o.order_items) : o.order_items,
            // If auto-advanced, update order status too
            status: order_auto_advanced ? 'READY' : o.status,
          }
        })
      )

      if (order_auto_advanced) {
        toast.success('All items done — order marked READY! 🎉', { duration: 5000 })
      }
    } catch (err) {
      toast.error('Failed to update item')
    } finally {
      setBusy(false)
    }
  }

  const sorted = [...orders].sort((a, b) => {
    if (sortBy === 'priority') return (b.priority_score || 0) - (a.priority_score || 0)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const getElapsedColor = (createdAt: string) => {
    const mins = (Date.now() - new Date(createdAt).getTime()) / 60000
    if (mins > 20) return 'text-red-400'
    if (mins > 10) return 'text-amber-400'
    return 'text-emerald-400'
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden kitchen-font">
      {/* Hidden audio */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" />
      </audio>

      {/* Header */}
      <header className="bg-gray-900 border-b-2 border-indigo-500 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-white">KITCHEN DISPLAY</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {sorted.filter((o) => o.status === 'CREATED').length > 0 && (
              <span className="text-gray-300 font-semibold">{sorted.filter((o) => o.status === 'CREATED').length} new · </span>
            )}
            {sorted.filter((o) => o.status === 'ACCEPTED').length} accepted ·{' '}
            {sorted.filter((o) => o.status === 'PREPARING').length} preparing
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <><WifiIcon className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400">Live</span></>
            ) : (
              <><ExclamationCircleIcon className="w-4 h-4 text-amber-400" /><span className="text-xs text-amber-400">Offline</span></>
            )}
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            {(['time', 'priority'] as SortBy[]).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortBy === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s === 'time' ? 'By Time' : 'By Priority'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Orders grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading orders…</div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <CheckCircleIcon className="w-16 h-16 text-emerald-500 opacity-50" />
            <p className="text-2xl text-gray-400 font-medium">All caught up!</p>
            <p className="text-gray-600 text-sm">No active orders in the kitchen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {sorted.map((order) => {
              const items = order.order_items || order.items || []
              const isDelayed = delayedOrderIds.has(order.id)
              // Delayed orders get a red border regardless of status
              const cardColor = isDelayed
                ? 'border-red-500 bg-red-950'
                : (CARD_COLORS[order.status] || 'border-gray-600 bg-gray-900')
              const elapsedColor = getElapsedColor(order.created_at)

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border-2 ${cardColor} flex flex-col min-h-[280px] overflow-hidden`}
                >
                  {/* Card header */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-bold text-white">{order.order_number}</span>
                      <div className="flex items-center gap-1.5">
                        {isDelayed && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                            DELAYED
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'READY'
                              ? 'bg-emerald-500 text-white'
                              : order.status === 'PREPARING'
                              ? 'bg-amber-500 text-white'
                              : order.status === 'CREATED'
                              ? 'bg-gray-500 text-white'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`flex items-center gap-1 font-mono font-bold ${elapsedColor}`}>
                        <ClockIcon className="w-3.5 h-3.5" />
                        {formatElapsed(order.created_at)}
                      </span>
                      {order.table?.table_number && (
                        <span className="text-gray-400">Table {order.table.table_number}</span>
                      )}
                      {(order as any).token_number && (
                        <span className="text-emerald-300 font-bold text-sm tracking-wide">
                          🎫 {(order as any).token_number}
                        </span>
                      )}
                      <span className="text-gray-500 uppercase text-xs">{order.order_source}</span>
                      {/* Item progress: X/Y done */}
                      {items.length > 0 && (
                        <span className="ml-auto text-xs font-medium text-white/60">
                          {items.filter((i) => i.status === 'DONE').length}/{items.length} done
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto scrollbar-thin">
                    {items.map((item, idx) => {
                      const isDone = item.status === 'DONE'
                      return (
                        <div key={item.id || idx} className={`flex items-start gap-2 transition-opacity ${isDone ? 'opacity-50' : ''}`}>
                          {/* Checkbox — tapping marks item done/pending */}
                          <button
                            onClick={() => item.id && toggleItemDone(order.id, item.id, item.status || 'PENDING')}
                            disabled={busy}
                            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-white/40 hover:border-white/80 bg-transparent'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={isDone ? 'Undo' : 'Mark done'}
                          >
                            {isDone && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
                            {item.quantity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-tight ${isDone ? 'line-through text-white/40' : 'text-white'}`}>
                              {item.menu_item_name || item.menu_item_id}
                            </p>
                            {item.special_instructions && (
                              <p className="text-xs text-amber-300 mt-0.5">
                                📝 {item.special_instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {order.special_instructions && (
                      <div className="mt-2 p-2 bg-white/5 rounded-lg text-xs text-gray-300">
                        📋 {order.special_instructions}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-white/10 space-y-2">
                    {order.status === 'CREATED' && (
                      <button
                        onClick={() => updateStatus(order.id, 'ACCEPTED')}
                        disabled={busy}
                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Accept Order ✓
                      </button>
                    )}
                    {order.status === 'ACCEPTED' && (
                      <button
                        onClick={() => updateStatus(order.id, 'PREPARING')}
                        disabled={busy}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Start Preparing
                      </button>
                    )}
                    {order.status === 'PREPARING' && (
                      <button
                        onClick={() => updateStatus(order.id, 'READY')}
                        disabled={busy}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Mark Ready ✓
                      </button>
                    )}
                    {/* READY orders disappear from kitchen — waiter collects payment */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => printKOT(order, items)}
                        className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                        title="Print KOT"
                      >
                        <PrinterIcon className="w-3.5 h-3.5" />
                        KOT
                      </button>
                      <button
                        onClick={() => updateStatus(order.id, 'CANCELLED')}
                        disabled={busy}
                        className="flex-1 py-1.5 bg-transparent border border-red-500/50 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Kitchen
