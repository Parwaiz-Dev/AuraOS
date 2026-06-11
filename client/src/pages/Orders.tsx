import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import { useSocket } from '../contexts/SocketContext'
import OrderForm from '../components/OrderForm'
import PaymentForm from '../components/PaymentForm'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import Card from '../components/Card'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import { Order, OrderStatus, OrderType } from '../types/order'
import { formatCurrency, formatRelative } from '../lib/utils'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  PencilSquareIcon,
  CurrencyDollarIcon,
  XCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

const STATUS_BADGE: Record<OrderStatus, { variant: any; label: string }> = {
  CREATED:   { variant: 'default',  label: 'New' },
  ACCEPTED:  { variant: 'info',     label: 'Accepted' },
  PREPARING: { variant: 'warning',  label: 'Preparing' },
  READY:     { variant: 'success',  label: 'Ready to Pay' },
  COMPLETED: { variant: 'success',  label: 'Completed' },
  CANCELLED: { variant: 'error',    label: 'Cancelled' },
}

// Next status for kitchen-only transitions (READY is handled via payment, not a button)
const NEXT_ACTION: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  CREATED:   { next: 'ACCEPTED',  label: 'Accept' },
  ACCEPTED:  { next: 'PREPARING', label: 'Start Prep' },
  PREPARING: { next: 'READY',     label: 'Mark Ready' },
}

type Tab = 'active' | 'ready' | 'completed' | 'all'

const TABS: { id: Tab; label: string; statuses: OrderStatus[] | null }[] = [
  { id: 'active',    label: 'Active',           statuses: ['CREATED', 'ACCEPTED', 'PREPARING'] },
  { id: 'ready',     label: 'Awaiting Payment', statuses: ['READY'] },
  { id: 'completed', label: 'Completed',        statuses: ['COMPLETED'] },
  { id: 'all',       label: 'All',              statuses: null },
]

const ITEMS_PER_PAGE = 12

const Orders: React.FC = () => {
  const navigate = useNavigate()
  const { socket } = useSocket()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | undefined>()
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [payingOrderId, setPayingOrderId] = useState<string>()
  const [busyId, setBusyId] = useState<string>()

  const [tab, setTab] = useState<Tab>('active')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<OrderType | 'ALL'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders', { params: { limit: 300 } })
      setOrders(res.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    if (!socket) return
    const onChange = () => fetchOrders()
    socket.on('ORDER_CREATED', onChange)
    socket.on('ORDER_UPDATED', onChange)
    socket.on('ORDER_DELETED', onChange)
    return () => {
      socket.off('ORDER_CREATED', onChange)
      socket.off('ORDER_UPDATED', onChange)
      socket.off('ORDER_DELETED', onChange)
    }
  }, [socket, fetchOrders])

  // Counts per tab
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { active: 0, ready: 0, completed: 0, all: orders.length }
    orders.forEach((o) => {
      if (['CREATED', 'ACCEPTED', 'PREPARING'].includes(o.status)) c.active++
      else if (o.status === 'READY') c.ready++
      else if (o.status === 'COMPLETED') c.completed++
    })
    return c
  }, [orders])

  const filtered = useMemo(() => {
    const tabDef = TABS.find((t) => t.id === tab)!
    let list = tabDef.statuses
      ? orders.filter((o) => tabDef.statuses!.includes(o.status))
      : [...orders]

    if (typeFilter !== 'ALL') list = list.filter((o) => o.order_type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.table?.table_number?.toString().includes(q)
      )
    }
    // Active first, newest first
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [orders, tab, typeFilter, search])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  useEffect(() => { setCurrentPage(1) }, [tab, search, typeFilter])

  const advanceStatus = async (order: Order) => {
    const action = NEXT_ACTION[order.status]
    if (!action) return
    setBusyId(order.id)
    try {
      await api.patch(`/orders/${order.id}`, { status: action.next })
      setOrders((p) => p.map((o) => (o.id === order.id ? { ...o, status: action.next } : o)))
      toast.success(`Order ${action.next.toLowerCase()}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(undefined)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this order?')) return
    setBusyId(id)
    try {
      await api.patch(`/orders/${id}`, { status: 'CANCELLED' })
      setOrders((p) => p.map((o) => (o.id === id ? { ...o, status: 'CANCELLED' as OrderStatus } : o)))
      toast.success('Order cancelled')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(undefined)
    }
  }

  if (loading) return <Loading text="Loading orders…" />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track all orders in real time</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          leftIcon={<PlusIcon className="w-5 h-5" />}
          onClick={() => { setEditingOrder(undefined); setIsFormOpen(true) }}
        >
          New Order
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search order # or table…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
          fullWidth
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="form-select min-w-[140px]"
        >
          <option value="ALL">All Types</option>
          <option value="DINE_IN">Dine In</option>
          <option value="PARCEL">Parcel</option>
          <option value="ONLINE">Online</option>
        </select>
      </div>

      {/* Order cards grid */}
      {paginated.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardDocumentListIcon className="w-7 h-7" />}
            title={orders.length === 0 ? 'No orders yet' : 'Nothing here'}
            description={
              orders.length === 0
                ? 'Create your first order to get started.'
                : 'No orders match this view.'
            }
            action={
              orders.length === 0
                ? { label: 'Create Order', onClick: () => setIsFormOpen(true) }
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map((order) => {
            const badge = STATUS_BADGE[order.status]
            const action = NEXT_ACTION[order.status]
            const isActive = !['COMPLETED', 'CANCELLED'].includes(order.status)
            const itemCount = (order.order_items || order.items || []).length
            const isBusy = busyId === order.id

            return (
              <Card key={order.id} padding="none" className="overflow-hidden flex flex-col">
                {/* Card header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <button
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                  >
                    {order.order_number}
                  </button>
                  <Badge variant={badge.variant} dot>{badge.label}</Badge>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {order.table?.table_number ? (
                        <span className="font-medium text-gray-700">Table {order.table.table_number}</span>
                      ) : (
                        <span className="uppercase text-xs text-gray-400">{order.order_type}</span>
                      )}
                    </span>
                    <span className="text-gray-400 text-xs">{formatRelative(order.created_at)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(Number(order.total_amount || 0))}
                    </span>
                  </div>
                </div>

                {/* Card actions */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                  {/* READY → single Collect Payment action */}
                  {order.status === 'READY' && (
                    <div className="mb-2">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
                        onClick={() => { setPayingOrderId(order.id); setIsPaymentOpen(true) }}
                      >
                        Collect Payment
                      </Button>
                    </div>
                  )}

                  {/* Active kitchen stages → advance button */}
                  {isActive && order.status !== 'READY' && (
                    <div className="flex gap-2 mb-2">
                      {action && (
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          isLoading={isBusy}
                          rightIcon={<ArrowRightIcon className="w-3.5 h-3.5" />}
                          onClick={() => advanceStatus(order)}
                        >
                          {action.label}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Secondary icon actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/orders/${order.id}`)}
                      title="View details"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    {isActive && (
                      <button
                        onClick={() => navigate(`/orders/${order.id}`)}
                        title="Add more items"
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    )}
                    {isActive && (
                      <button
                        onClick={() => { setEditingOrder(order); setIsFormOpen(true) }}
                        title="Edit note"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                    )}
                    {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        title="Cancel order"
                        className="ml-auto p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {isFormOpen && (
        <OrderForm
          order={editingOrder}
          onClose={() => setIsFormOpen(false)}
          onSave={() => {
            setIsFormOpen(false)
            fetchOrders()
          }}
        />
      )}

      {isPaymentOpen && payingOrderId && (
        <PaymentForm
          orderId={payingOrderId}
          onClose={() => setIsPaymentOpen(false)}
          onPaymentSuccess={() => {
            setIsPaymentOpen(false)
            toast.success('Payment recorded')
            fetchOrders()
          }}
        />
      )}
    </div>
  )
}

export default Orders
