import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Card from '../components/Card'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Pagination from '../components/Pagination'
import { formatDate } from '../lib/utils'
import {
  PencilIcon, CubeIcon, MagnifyingGlassIcon,
  ClockIcon, ArrowUpIcon, ArrowDownIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'

interface InventoryItem {
  id: string
  restaurant_id: string
  menu_item_id: string
  menu_item_name?: string
  current_stock: number
  reorder_level: number
  last_restocked_at?: string
}

interface InventoryStats {
  total_items: number
  low_stock_items: number
  average_stock: number
  total_stock: number
}

interface InventoryTransaction {
  id: string
  menu_item_name: string
  quantity_before: number
  quantity_after: number
  quantity_change: number
  transaction_type: 'RESTOCK' | 'ADJUSTMENT' | 'USAGE' | 'INITIAL'
  notes?: string | null
  changed_by_name?: string | null
  created_at: string
}

const TX_ICON: Record<string, React.ReactNode> = {
  RESTOCK:    <ArrowUpIcon className="w-3.5 h-3.5 text-emerald-500" />,
  USAGE:      <ArrowDownIcon className="w-3.5 h-3.5 text-red-500" />,
  ADJUSTMENT: <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-blue-500" />,
  INITIAL:    <ClockIcon className="w-3.5 h-3.5 text-gray-400" />,
}

const TX_COLOR: Record<string, string> = {
  RESTOCK:    'text-emerald-600',
  USAGE:      'text-red-600',
  ADJUSTMENT: 'text-blue-600',
  INITIAL:    'text-gray-500',
}

const HISTORY_PER_PAGE = 20

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [newStock, setNewStock] = useState(0)
  const [newReorder, setNewReorder] = useState(0)
  const [adjustNotes, setAdjustNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // History panel
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
  const [history, setHistory] = useState<InventoryTransaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'Low' | 'Out'>('ALL')

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [itemsRes, statsRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/stats'),
      ])
      setItems(itemsRes.data.data || [])
      setStats(statsRes.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const getStatus = (item: InventoryItem) => {
    if (item.current_stock === 0) return { label: 'Out', variant: 'error' as const }
    if (item.current_stock <= item.reorder_level) return { label: 'Low', variant: 'warning' as const }
    return { label: 'OK', variant: 'success' as const }
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const status = getStatus(item)
      const matchStatus = statusFilter === 'ALL' || status.label === statusFilter
      const matchSearch = !search || (item.menu_item_name || item.menu_item_id).toLowerCase().includes(search.toLowerCase())
      return matchStatus && matchSearch
    })
  }, [items, search, statusFilter])

  const openAdjust = (item: InventoryItem) => {
    setSelected(item)
    setNewStock(item.current_stock)
    setNewReorder(item.reorder_level)
    setAdjustNotes('')
    setAdjustOpen(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.patch(`/inventory/${selected.id}`, {
        current_stock: newStock,
        reorder_level: newReorder,
        notes: adjustNotes || undefined,
      })
      toast.success('Stock updated')
      setAdjustOpen(false)
      fetchAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item)
    setHistoryOpen(true)
    setHistoryPage(1)
    setHistoryLoading(true)
    try {
      const res = await api.get(`/inventory/${item.id}/history`, { params: { limit: 100 } })
      setHistory(res.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setHistoryLoading(false)
    }
  }

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PER_PAGE
    return history.slice(start, start + HISTORY_PER_PAGE)
  }, [history, historyPage])

  const historyTotalPages = Math.ceil(history.length / HISTORY_PER_PAGE)

  if (loading) return <Loading text="Loading inventory…" />

  const lowCount = items.filter((i) => i.current_stock <= i.reorder_level && i.current_stock > 0).length
  const outCount = items.filter((i) => i.current_stock === 0).length

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track stock levels and reorder points</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Items',   value: stats?.total_items || 0,  color: 'text-indigo-600' },
          { label: 'Total Stock',   value: stats?.total_stock || 0,  color: 'text-gray-900' },
          { label: 'Low Stock',     value: lowCount,                  color: 'text-amber-600' },
          { label: 'Out of Stock',  value: outCount,                  color: 'text-red-600' },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
            fullWidth
          />
          <div className="flex gap-2">
            {(['ALL', 'OK', 'Low', 'Out'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CubeIcon className="w-7 h-7" />}
            title="No inventory items"
            description="Inventory items are created automatically when menu items are added."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                  <th>Last Restocked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const status = getStatus(item)
                  return (
                    <tr key={item.id}>
                      <td className="font-medium text-gray-900">
                        {item.menu_item_name || item.menu_item_id}
                      </td>
                      <td>
                        <span className={`font-bold text-lg ${
                          item.current_stock === 0 ? 'text-red-600'
                          : item.current_stock <= item.reorder_level ? 'text-amber-600'
                          : 'text-gray-900'
                        }`}>
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="text-gray-500">{item.reorder_level}</td>
                      <td><Badge variant={status.variant} dot>{status.label}</Badge></td>
                      <td className="text-gray-400 text-xs">
                        {item.last_restocked_at
                          ? new Date(item.last_restocked_at).toLocaleDateString('en-IN')
                          : 'Never'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openAdjust(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            Adjust
                          </button>
                          <button
                            onClick={() => openHistory(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                          >
                            <ClockIcon className="w-3.5 h-3.5" />
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Adjust Modal */}
      <Modal
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={`Adjust Stock — ${selected?.menu_item_name || ''}`}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="primary" fullWidth isLoading={saving} onClick={handleSave}>
              Save Changes
            </Button>
            <Button variant="outline" fullWidth onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
            Current stock: <span className="font-bold text-gray-900">{selected?.current_stock}</span>
          </div>
          <Input
            label="New Stock Level"
            type="number"
            min={0}
            value={newStock}
            onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
            fullWidth
          />
          <Input
            label="Reorder Level"
            type="number"
            min={0}
            value={newReorder}
            onChange={(e) => setNewReorder(parseInt(e.target.value) || 0)}
            hint="Alert when stock falls to or below this level"
            fullWidth
          />
          <Input
            label="Reason / Notes (optional)"
            placeholder="e.g. Received from supplier, Inventory count, Wastage"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            fullWidth
          />
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Stock History — ${historyItem?.menu_item_name || ''}`}
        size="lg"
      >
        {historyLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ClockIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No history yet</p>
            <p className="text-xs mt-1">Changes will appear here after the first adjustment</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Change</th>
                    <th>Notes</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((tx) => (
                    <tr key={tx.id}>
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          {TX_ICON[tx.transaction_type]}
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="text-gray-500">{tx.quantity_before}</td>
                      <td className="font-semibold">{tx.quantity_after}</td>
                      <td className={`font-bold ${TX_COLOR[tx.transaction_type]}`}>
                        {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change}
                      </td>
                      <td className="text-gray-500 text-xs max-w-[150px] truncate">
                        {tx.notes || '—'}
                      </td>
                      <td className="text-gray-400 text-xs">
                        {tx.changed_by_name || 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyTotalPages > 1 && (
              <div className="flex justify-center">
                <Pagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={setHistoryPage}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Inventory
