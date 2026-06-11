/**
 * Tables — the command center for waiters and reception.
 *
 * Each table is colour-coded by occupancy so staff can see the whole floor at
 * a glance and act without hunting through the Orders list:
 *   🟢 Free            → tap to start a NEW order (POS opens pre-filled)
 *   🔵 Occupied        → has an open order (shows ₹ + item count); tap to manage
 *   🟡 Ready to pay    → order is READY; tap to print bill / collect payment
 *
 * Tapping an occupied table opens TableOrderPanel (a slide-over) with one-tap
 * actions: Add Items, Print KOT, Print Bill, Collect Payment, advance status.
 *
 * Admins still get the Add/Edit/Delete management controls.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import TableForm from '../components/TableForm'
import OrderForm from '../components/OrderForm'
import PaymentForm from '../components/PaymentForm'
import TableOrderPanel from '../components/TableOrderPanel'
import BillScreen from '../components/BillScreen'
import Button from '../components/Button'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import { Table, TableWithStatus } from '../types/table'
import {
  PlusIcon,
  Cog6ToothIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

// Visual treatment for each occupancy state
type Occupancy = 'free' | 'occupied' | 'ready'

const occupancyStyles: Record<Occupancy, { ring: string; badge: string; dot: string; label: string }> = {
  free: {
    ring: 'border-gray-200 hover:border-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-400',
    label: 'Free',
  },
  occupied: {
    ring: 'border-blue-300 ring-2 ring-blue-100 hover:border-blue-400',
    badge: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    label: 'Occupied',
  },
  ready: {
    ring: 'border-amber-300 ring-2 ring-amber-100 hover:border-amber-400',
    badge: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-400 animate-pulse',
    label: 'Ready to pay',
  },
}

function getOccupancy(t: TableWithStatus): Occupancy {
  if (!t.active_order) return 'free'
  if (t.active_order.status === 'READY') return 'ready'
  return 'occupied'
}

const Tables: React.FC = () => {
  const { on, off } = useSocket()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [tables, setTables] = useState<TableWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  // Admin table CRUD form
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Table | undefined>()
  const [manageMode, setManageMode] = useState(false)

  // Order flows
  const [orderForTable, setOrderForTable] = useState<TableWithStatus | null>(null) // new / add-items POS
  const [panelTable, setPanelTable] = useState<TableWithStatus | null>(null)        // occupied table drawer
  const [payOrderId, setPayOrderId] = useState<string | null>(null)
  const [billOrderId, setBillOrderId] = useState<string | null>(null)               // bill screen for READY
  const [billTableNumber, setBillTableNumber] = useState<string | undefined>()
  const [panelRefresh, setPanelRefresh] = useState(0)

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get('/tables/with-status')
      setTables(res.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTables() }, [fetchTables])

  // Refetch occupancy on any order/table change so colours stay live
  useEffect(() => {
    const refresh = () => fetchTables()
    on('ORDER_CREATED', refresh)
    on('ORDER_UPDATED', refresh)
    on('ORDER_COMPLETED', refresh)
    on('ORDER_CANCELLED', refresh)
    on('ORDER_DELETED', refresh)
    on('TABLE_UPDATED', refresh)
    on('TABLE_CREATED', refresh)
    on('TABLE_DELETED', refresh)
    return () => {
      off('ORDER_CREATED'); off('ORDER_UPDATED'); off('ORDER_COMPLETED')
      off('ORDER_CANCELLED'); off('ORDER_DELETED')
      off('TABLE_UPDATED'); off('TABLE_CREATED'); off('TABLE_DELETED')
    }
  }, [on, off, fetchTables])

  const stats = useMemo(() => {
    const occupied = tables.filter((t) => t.active_order && t.active_order.status !== 'READY').length
    const ready = tables.filter((t) => t.active_order?.status === 'READY').length
    const free = tables.filter((t) => !t.active_order).length
    const openRevenue = tables.reduce((s, t) => s + (t.active_order?.total_amount || 0), 0)
    return { total: tables.length, occupied, ready, free, openRevenue }
  }, [tables])

  // Tap handler — free table → new order; READY table → bill screen; occupied → panel
  const handleTableTap = (t: TableWithStatus) => {
    if (manageMode) {
      setEditing(t); setFormOpen(true); return
    }
    if (!t.active_order) {
      setOrderForTable(t)
    } else if (t.active_order.status === 'READY') {
      // Open bill screen first — waiter shows bill, then collects payment
      setBillOrderId(t.active_order.id)
      setBillTableNumber(t.table_number)
      setPanelTable(t) // keep panel reference for post-payment cleanup
    } else {
      setPanelTable(t)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this table?')) return
    try {
      await api.delete(`/tables/${id}`)
      setTables((p) => p.filter((t) => t.id !== id))
      toast.success('Table deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <Loading text="Loading floor…" />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Floor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tap a table to take or manage an order
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant={manageMode ? 'primary' : 'outline'}
              leftIcon={<Cog6ToothIcon className="w-4 h-4" />}
              onClick={() => setManageMode((m) => !m)}
            >
              {manageMode ? 'Done' : 'Manage'}
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              onClick={() => { setEditing(undefined); setFormOpen(true) }}
            >
              Add Table
            </Button>
          </div>
        )}
      </div>

      {/* Occupancy stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Free', value: stats.free, color: 'text-emerald-600' },
          { label: 'Occupied', value: stats.occupied, color: 'text-blue-600' },
          { label: 'Ready to pay', value: stats.ready, color: 'text-amber-600' },
          { label: 'Open revenue', value: `₹${stats.openRevenue.toFixed(0)}`, color: 'text-gray-900' },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Ready to pay</span>
        {manageMode && <span className="text-indigo-600 font-medium ml-auto">Manage mode: tap a table to edit</span>}
      </div>

      {/* Floor grid */}
      {tables.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TableCellsIcon className="w-7 h-7" />}
            title="No tables yet"
            description={isAdmin ? 'Add tables to start managing your floor.' : 'Ask an admin to set up tables.'}
            action={isAdmin ? { label: 'Add Table', onClick: () => { setEditing(undefined); setFormOpen(true) } } : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {tables.map((table) => {
            const occ = getOccupancy(table)
            const style = occupancyStyles[occ]
            const inactive = !table.is_active
            return (
              <div key={table.id} className="relative">
                <button
                  onClick={() => handleTableTap(table)}
                  disabled={inactive && !manageMode}
                  className={`w-full text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${style.ring}`}
                >
                  {/* Status dot */}
                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${style.dot}`} />

                  {/* Table number */}
                  <p className="text-2xl font-bold text-gray-900">{table.table_number}</p>
                  <p className="text-xs text-gray-400">{table.seats} seats</p>

                  {/* Occupancy detail */}
                  <div className={`mt-3 inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${style.badge}`}>
                    {style.label}
                  </div>

                  {table.active_order && (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-sm font-bold text-gray-900">
                        ₹{table.active_order.total_amount.toFixed(0)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {table.active_order.item_count} item{table.active_order.item_count !== 1 ? 's' : ''} · {table.active_order.order_number.slice(-4)}
                      </p>
                    </div>
                  )}
                </button>

                {/* Manage-mode delete (admin) — sibling so we don't nest buttons */}
                {manageMode && (
                  <button
                    onClick={() => handleDelete(table.id)}
                    className="absolute bottom-2 right-2 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete table"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Admin: create/edit table */}
      {formOpen && (
        <TableForm
          table={editing}
          onClose={() => setFormOpen(false)}
          onSave={() => { setFormOpen(false); fetchTables() }}
        />
      )}

      {/* New order / add items POS for a tapped table */}
      {orderForTable && (
        <OrderForm
          initialTableId={orderForTable.id}
          onClose={() => setOrderForTable(null)}
          onSave={() => { setOrderForTable(null); fetchTables() }}
        />
      )}

      {/* Occupied table management drawer — hide when bill screen is open */}
      {panelTable && panelTable.active_order && !billOrderId && (
        <TableOrderPanel
          tableNumber={panelTable.table_number}
          orderId={panelTable.active_order.id}
          refreshKey={panelRefresh}
          onClose={() => setPanelTable(null)}
          onChanged={() => fetchTables()}
          onAddItems={() => {
            const t = panelTable
            setPanelTable(null)
            setOrderForTable(t)
          }}
          onCollectPayment={() => {
            setBillOrderId(panelTable.active_order!.id)
            setBillTableNumber(panelTable.table_number)
          }}
        />
      )}

      {/* Bill screen — shown for READY orders before payment */}
      {billOrderId && (
        <BillScreen
          orderId={billOrderId}
          tableNumber={billTableNumber}
          onClose={() => {
            setBillOrderId(null)
            setBillTableNumber(undefined)
          }}
          onCompleted={() => {
            setBillOrderId(null)
            setBillTableNumber(undefined)
            setPanelTable(null)
            setPanelRefresh((k) => k + 1)
            fetchTables()
          }}
        />
      )}

      {/* Legacy payment form — for non-READY manual payment from panel */}
      {payOrderId && (
        <PaymentForm
          orderId={payOrderId}
          onClose={() => setPayOrderId(null)}
          onPaymentSuccess={async () => {
            setPayOrderId(null)
            toast.success('Payment recorded')
            try {
              if (panelTable?.active_order) {
                await api.patch(`/orders/${panelTable.active_order.id}`, { status: 'COMPLETED' })
              }
            } catch { /* ignore — payment already recorded */ }
            setPanelTable(null)
            setPanelRefresh((k) => k + 1)
            fetchTables()
          }}
        />
      )}
    </div>
  )
}

export default Tables
