/**
 * ZomatoSettings — Admin page to manage Zomato item mappings.
 *
 * The problem: Zomato sends orders with their own item IDs (e.g. "12345678").
 * These don't match your internal menu item UUIDs.
 *
 * This page lets you map each Zomato item ID to the correct menu item.
 * Once mapped, Zomato orders will correctly show item names and use your prices.
 *
 * How to find Zomato item IDs:
 *   1. Place a test order on Zomato
 *   2. Check the webhook payload in the integration logs
 *   3. Each item has an item_id — that's what you map here
 *
 * Or: ask your Zomato account manager for the item ID list.
 */

import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import Button from '../components/Button'
import Input from '../components/Input'
import Card from '../components/Card'
import Modal from '../components/Modal'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { MenuItem } from '../types/menu'
import {
  PlusIcon, TrashIcon, MagnifyingGlassIcon,
  CheckCircleIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface ZomatoMapping {
  id: string
  zomato_item_id: string
  zomato_item_name?: string
  menu_item_id: string
  menu_item_name?: string
  created_at: string
}

interface SyncStatus {
  last_sync: string | null
  total_synced: number
  total_failed: number
  unmapped_count: number
}

const ZomatoSettings: React.FC = () => {
  const [mappings, setMappings] = useState<ZomatoMapping[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [zomatoId, setZomatoId] = useState('')
  const [zomatoName, setZomatoName] = useState('')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('')
  const [menuSearch, setMenuSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Filter
  const [search, setSearch] = useState('')

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [mappingsRes, menuRes, statusRes] = await Promise.all([
        api.get('/integrations/zomato/mappings'),
        api.get('/menus/items'),
        api.get('/integrations/zomato/sync-status'),
      ])
      setMappings(mappingsRes.data.data || [])
      setMenuItems((menuRes.data.data || []).filter((m: MenuItem) => m.is_active))
      setSyncStatus(statusRes.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filteredMappings = useMemo(() => {
    if (!search) return mappings
    const q = search.toLowerCase()
    return mappings.filter(
      (m) =>
        m.zomato_item_id.toLowerCase().includes(q) ||
        (m.zomato_item_name || '').toLowerCase().includes(q) ||
        (m.menu_item_name || '').toLowerCase().includes(q),
    )
  }, [mappings, search])

  const filteredMenuItems = useMemo(() => {
    if (!menuSearch) return menuItems
    return menuItems.filter((m) => m.name.toLowerCase().includes(menuSearch.toLowerCase()))
  }, [menuItems, menuSearch])

  const openForm = () => {
    setZomatoId('')
    setZomatoName('')
    setSelectedMenuItemId('')
    setMenuSearch('')
    setFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zomatoId.trim()) { toast.error('Enter the Zomato item ID'); return }
    if (!selectedMenuItemId) { toast.error('Select a menu item'); return }

    setSaving(true)
    try {
      const res = await api.post('/integrations/zomato/mappings', {
        zomato_item_id:   zomatoId.trim(),
        zomato_item_name: zomatoName.trim() || undefined,
        menu_item_id:     selectedMenuItemId,
      })
      const saved = res.data.data
      setMappings((prev) => {
        const existing = prev.findIndex((m) => m.zomato_item_id === saved.zomato_item_id)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = saved
          return next
        }
        return [saved, ...prev]
      })
      toast.success('Mapping saved')
      setFormOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mapping?')) return
    try {
      await api.delete(`/integrations/zomato/mappings/${id}`)
      setMappings((prev) => prev.filter((m) => m.id !== id))
      toast.success('Mapping deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <Loading text="Loading Zomato settings…" />

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Zomato Integration</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Map Zomato item IDs to your menu items so orders import correctly
        </p>
      </div>

      {/* Sync status */}
      {syncStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Orders Synced',  value: syncStatus.total_synced,   color: 'text-emerald-600' },
            { label: 'Failed Orders',  value: syncStatus.total_failed,   color: syncStatus.total_failed > 0 ? 'text-red-600' : 'text-gray-900' },
            { label: 'Item Mappings',  value: syncStatus.unmapped_count, color: 'text-indigo-600' },
            {
              label: 'Last Sync',
              value: syncStatus.last_sync
                ? new Date(syncStatus.last_sync).toLocaleDateString('en-IN')
                : 'Never',
              color: 'text-gray-700',
            },
          ].map((s) => (
            <Card key={s.label} padding="sm">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">How to find Zomato item IDs</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Place a test order on Zomato for your restaurant</li>
              <li>The webhook will fire — check the integration logs for the payload</li>
              <li>Each item in the payload has an <code className="bg-blue-100 px-1 rounded">item_id</code> field</li>
              <li>Add that ID here and map it to the correct menu item</li>
            </ol>
            <p className="text-blue-600 text-xs mt-2">
              Alternatively, ask your Zomato account manager for the item ID list.
            </p>
          </div>
        </div>
      </Card>

      {/* Mappings table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search by Zomato ID or item name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
            fullWidth
          />
          <Button
            variant="primary"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openForm}
          >
            Add Mapping
          </Button>
        </div>

        {filteredMappings.length === 0 ? (
          <Card>
            <EmptyState
              title="No mappings yet"
              description="Add a mapping to connect Zomato item IDs to your menu items."
              action={{ label: 'Add Mapping', onClick: openForm }}
            />
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zomato Item ID</th>
                    <th>Zomato Item Name</th>
                    <th>→ Your Menu Item</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td className="font-mono text-sm text-gray-700">{mapping.zomato_item_id}</td>
                      <td className="text-gray-500">{mapping.zomato_item_name || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-medium text-gray-900">{mapping.menu_item_name}</span>
                        </div>
                      </td>
                      <td className="text-gray-400 text-xs">
                        {new Date(mapping.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Add mapping modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add Item Mapping"
        size="md"
        footer={
          <div className="flex gap-3">
            <Button type="submit" form="mapping-form" variant="primary" fullWidth isLoading={saving}>
              Save Mapping
            </Button>
            <Button variant="outline" fullWidth onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form id="mapping-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Zomato Item ID"
            placeholder="e.g. 12345678"
            value={zomatoId}
            onChange={(e) => setZomatoId(e.target.value)}
            hint="The item_id from the Zomato webhook payload"
            required
            fullWidth
          />
          <Input
            label="Zomato Item Name (optional)"
            placeholder="e.g. Chicken Biryani (for your reference)"
            value={zomatoName}
            onChange={(e) => setZomatoName(e.target.value)}
            hint="Just for display — helps you identify the mapping"
            fullWidth
          />
          <div>
            <label className="form-label">
              Your Menu Item <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Search menu items…"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
              fullWidth
            />
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {filteredMenuItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No items found</p>
              ) : (
                filteredMenuItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMenuItemId(item.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedMenuItemId === item.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="text-gray-400 ml-2">₹{item.price}</span>
                    {selectedMenuItemId === item.id && (
                      <CheckCircleIcon className="w-4 h-4 text-indigo-600 inline ml-2" />
                    )}
                  </button>
                ))
              )}
            </div>
            {selectedMenuItemId && (
              <p className="text-xs text-emerald-600 mt-1">
                ✓ Selected: {menuItems.find((m) => m.id === selectedMenuItemId)?.name}
              </p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ZomatoSettings
