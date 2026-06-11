import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import { MenuItem, MenuCategory } from '../types/menu'
import { formatCurrency } from '../lib/utils'
import Button from './Button'
import Input from './Input'
import {
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'

interface CartLine {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions?: string
}

interface AddItemsModalProps {
  orderId: string
  orderNumber: string
  onClose: () => void
  onAdded: () => void
}

/**
 * Lightweight modal to append items to an existing open order (running tab).
 * Works for any order type.
 */
const AddItemsModal: React.FC<AddItemsModalProps> = ({ orderId, orderNumber, onClose, onAdded }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('ALL')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/menus/items'), api.get('/menus/categories')])
      .then(([menuRes, catRes]) => {
        setMenuItems((menuRes.data.data || []).filter((m: MenuItem) => m.is_active))
        setCategories(catRes.data.data || [])
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return menuItems.filter((m) => {
      const matchCat = activeCat === 'ALL' || m.category_id === activeCat
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [menuItems, activeCat, search])

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.menu_item_id === item.id && !c.special_instructions)
      if (ex) {
        return prev.map((c) =>
          c.menu_item_id === item.id && !c.special_instructions
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  const changeQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev]
      next[idx].quantity += delta
      if (next[idx].quantity <= 0) next.splice(idx, 1)
      return next
    })
  }

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const count = cart.reduce((s, c) => s + c.quantity, 0)

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setSaving(true)
    try {
      await api.post(`/orders/${orderId}/items`, {
        items: cart.map((c) => ({
          menu_item_id: c.menu_item_id,
          quantity: c.quantity,
          special_instructions: c.special_instructions || undefined,
        })),
      })
      toast.success(`Added ${count} item${count > 1 ? 's' : ''} to ${orderNumber}`)
      onAdded()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Items</h2>
            <p className="text-xs text-indigo-600 font-medium">to {orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Menu */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
              <div className="p-4 space-y-3 border-b border-gray-100">
                <Input
                  placeholder="Search dishes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
                  fullWidth
                />
                <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                  <button
                    onClick={() => setActiveCat('ALL')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                      activeCat === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCat(c.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                        activeCat === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((item) => {
                    const inCart = cart.find((c) => c.menu_item_id === item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="relative text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-md transition-all"
                      >
                        {inCart && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                            {inCart.quantity}
                          </span>
                        )}
                        <p className="font-medium text-gray-900 text-sm leading-tight pr-6">{item.name}</p>
                        <p className="text-base font-bold text-indigo-600 mt-2">{formatCurrency(item.price)}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Cart */}
            <div className="w-56 lg:w-72 flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <ShoppingCartIcon className="w-5 h-5 text-gray-400" />
                <span className="font-semibold text-gray-900 text-sm">Adding {count > 0 && `(${count})`}</span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <ShoppingCartIcon className="w-10 h-10 text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">Tap dishes to add</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {cart.map((line, idx) => (
                      <div key={idx} className="p-3">
                        <div className="flex justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">{line.name}</p>
                          <span className="text-sm font-semibold">{formatCurrency(line.price * line.quantity)}</span>
                        </div>
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-fit mt-2">
                          <button onClick={() => changeQty(idx, -1)} className="p-1.5 hover:bg-gray-100 text-gray-600">
                            <MinusIcon className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-sm font-medium w-8 text-center">{line.quantity}</span>
                          <button onClick={() => changeQty(idx, 1)} className="p-1.5 hover:bg-gray-100 text-gray-600">
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Adding total</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  isLoading={saving}
                  disabled={cart.length === 0}
                  onClick={handleSubmit}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  Add to Order
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AddItemsModal
