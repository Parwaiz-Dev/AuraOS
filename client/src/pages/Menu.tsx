import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import MenuForm from '../components/MenuForm'
import Button from '../components/Button'
import Input from '../components/Input'
import Card from '../components/Card'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import { MenuCategory, MenuItem } from '../types/menu'
import { formatCurrency } from '../lib/utils'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
  TagIcon,
} from '@heroicons/react/24/outline'

const Menu: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | undefined>()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('ALL')
  const [availFilter, setAvailFilter] = useState<'all' | 'available' | 'unavailable'>('all')

  // Category management
  const [catFormOpen, setCatFormOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<MenuCategory | undefined>()
  const [catName, setCatName] = useState('')
  const [catDesc, setCatDesc] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menus/items'),
        api.get('/menus/categories'),
      ])
      setItems(itemsRes.data.data || [])
      setCategories(catsRes.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchCat = catFilter === 'ALL' || item.category_id === catFilter
      const matchAvail =
        availFilter === 'all' ||
        (availFilter === 'available' && item.is_active) ||
        (availFilter === 'unavailable' && !item.is_active)
      const matchSearch =
        !search || item.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchAvail && matchSearch
    })
  }, [items, catFilter, availFilter, search])

  const grouped = useMemo(() => {
    const map: Record<string, MenuItem[]> = {}
    filtered.forEach((item) => {
      const cat = categories.find((c) => c.id === item.category_id)
      const key = cat?.name || 'Uncategorized'
      if (!map[key]) map[key] = []
      map[key].push(item)
    })
    return map
  }, [filtered, categories])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu item?')) return
    try {
      await api.delete(`/menus/items/${id}`)
      setItems((p) => p.filter((i) => i.id !== id))
      toast.success('Item deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleToggleAvail = async (item: MenuItem) => {
    if (togglingId) return
    setTogglingId(item.id)
    try {
      const res = await api.put(`/menus/items/${item.id}`, { is_active: !item.is_active })
      setItems((p) => p.map((i) => (i.id === item.id ? res.data.data : i)))
      toast.success(item.is_active ? 'Item marked unavailable' : 'Item marked available')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault()
    setCatSaving(true)
    try {
      if (editingCat) {
        const res = await api.put(`/menus/categories/${editingCat.id}`, { name: catName, description: catDesc })
        setCategories((p) => p.map((c) => (c.id === editingCat.id ? res.data.data : c)))
        toast.success('Category updated')
      } else {
        const res = await api.post('/menus/categories', { name: catName, description: catDesc, display_order: categories.length + 1 })
        setCategories((p) => [...p, res.data.data])
        toast.success('Category created')
      }
      setCatFormOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setCatSaving(false)
    }
  }

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Delete this category? Items in it will be uncategorized.')) return
    try {
      await api.delete(`/menus/categories/${id}`)
      setCategories((p) => p.filter((c) => c.id !== id))
      toast.success('Category deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <Loading text="Loading menu…" />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length} items · {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<TagIcon className="w-4 h-4" />}
            onClick={() => { setEditingCat(undefined); setCatName(''); setCatDesc(''); setCatFormOpen(true) }}
          >
            Add Category
          </Button>
          <Button
            variant="primary"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={() => { setEditing(undefined); setFormOpen(true) }}
          >
            Add Item
          </Button>
        </div>
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
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="form-select min-w-[150px]"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['all', 'available', 'unavailable'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAvailFilter(f)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
                  availFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Categories quick view */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm"
            >
              <span className="font-medium text-gray-700">{cat.name}</span>
              <span className="text-gray-400 text-xs">
                {items.filter((i) => i.category_id === cat.id).length}
              </span>
              <button
                onClick={() => { setEditingCat(cat); setCatName(cat.name); setCatDesc(cat.description || ''); setCatFormOpen(true) }}
                className="text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDeleteCat(cat.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Items by category */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpenIcon className="w-7 h-7" />}
            title="No menu items"
            description="Add your first menu item to get started."
            action={{ label: 'Add Item', onClick: () => setFormOpen(true) }}
          />
        </Card>
      ) : (
        Object.entries(grouped).map(([catName, catItems]) => (
          <div key={catName}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {catName} <span className="text-gray-400 font-normal normal-case">({catItems.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {catItems.map((item) => (
                <Card key={item.id} padding="sm" className="group relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    <span className="text-base font-bold text-indigo-600 shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {item.is_vegetarian && (
                      <span className="text-xs text-emerald-600 font-medium">🌱 Veg</span>
                    )}
                    <span className="text-xs text-gray-400">⏱ {item.prep_time_minutes}m</span>
                    <div className="ml-auto">
                      <Badge variant={item.is_active ? 'success' : 'default'} className="text-xs">
                        {item.is_active ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-x-0 bottom-0 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white border-t border-gray-100 rounded-b-xl overflow-hidden">
                    <button
                      onClick={() => { setEditing(item); setFormOpen(true) }}
                      className="flex-1 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      Edit
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      onClick={() => handleToggleAvail(item)}
                      disabled={togglingId === item.id}
                      className="flex-1 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {item.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Item form */}
      {formOpen && (
        <MenuForm
          menuItem={editing}
          onClose={() => setFormOpen(false)}
          onSave={(saved) => {
            if (editing) {
              setItems((p) => p.map((i) => (i.id === saved.id ? saved : i)))
              toast.success('Item updated')
            } else {
              setItems((p) => [saved, ...p])
              toast.success('Item created')
            }
            setFormOpen(false)
          }}
        />
      )}

      {/* Category form */}
      <Modal
        isOpen={catFormOpen}
        onClose={() => setCatFormOpen(false)}
        title={editingCat ? 'Edit Category' : 'Add Category'}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button type="submit" form="cat-form" variant="primary" fullWidth isLoading={catSaving}>
              {editingCat ? 'Save' : 'Create'}
            </Button>
            <Button variant="outline" fullWidth onClick={() => setCatFormOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form id="cat-form" onSubmit={handleSaveCat} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Starters, Mains, Beverages"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
            fullWidth
          />
          <Input
            label="Description (optional)"
            placeholder="Brief description"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            fullWidth
          />
        </form>
      </Modal>
    </div>
  )
}

export default Menu
