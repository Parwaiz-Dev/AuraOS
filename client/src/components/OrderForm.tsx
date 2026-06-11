import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import { Order, OrderType, OrderSource } from '../types/order'
import { MenuItem, MenuCategory } from '../types/menu'
import { Table } from '../types/table'
import { formatCurrency } from '../lib/utils'
import { printKOT } from './PrintKOT'
import Button from './Button'
import Input from './Input'
import {
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  PrinterIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface CartLine {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions?: string
}

interface OrderFormProps {
  order?: Order // editing existing order metadata
  initialTableId?: string // pre-select a table (from Tables command center)
  onClose: () => void
  onSave: (order: Order) => void
}

const ORDER_TYPES: { value: OrderType; label: string; icon: string }[] = [
  { value: 'DINE_IN', label: 'Dine In', icon: '🍽️' },
  { value: 'PARCEL', label: 'Parcel', icon: '📦' },
  { value: 'ONLINE', label: 'Online', icon: '🌐' },
]

const ORDER_SOURCES: OrderSource[] = ['WAITER', 'RECEPTION', 'QR', 'WHATSAPP', 'ZOMATO']

const OrderForm: React.FC<OrderFormProps> = ({ order, initialTableId, onClose, onSave }) => {
  const isEditing = !!order

  // Lookups
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Order meta
  const [tableId, setTableId] = useState(order?.table_id || initialTableId || '')
  const [orderType, setOrderType] = useState<OrderType>(order?.order_type || 'DINE_IN')
  const [orderSource, setOrderSource] = useState<OrderSource>(order?.order_source || 'WAITER')
  const [notes, setNotes] = useState(order?.special_instructions || '')

  // Cart
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('ALL')
  const [saving, setSaving] = useState(false)

  // Existing-order detection (running tab)
  const [existingOrder, setExistingOrder] = useState<Order | null>(null)
  const [addToExisting, setAddToExisting] = useState(false)
  const [checkingTable, setCheckingTable] = useState(false)

  // After placing — show a success step with a one-tap KOT print button
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  const [placedItems, setPlacedItems] = useState<{ menu_item_id: string; menu_item_name: string; quantity: number; unit_price: number; special_instructions?: string }[]>([])

  // Load lookups
  useEffect(() => {
    const load = async () => {
      try {
        const [menuRes, catRes, tableRes] = await Promise.all([
          api.get('/menus/items'),
          api.get('/menus/categories'),
          api.get('/tables'),
        ])
        setMenuItems((menuRes.data.data || []).filter((m: MenuItem) => m.is_active))
        setCategories(catRes.data.data || [])
        setTables((tableRes.data.data || []).filter((t: Table) => t.is_active))
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [])

  // When a table is selected (new order, dine-in), check for an existing open order
  useEffect(() => {
    if (isEditing || orderType !== 'DINE_IN' || !tableId) {
      setExistingOrder(null)
      setAddToExisting(false)
      return
    }
    let cancelled = false
    setCheckingTable(true)
    api.get(`/orders/active/by-table/${tableId}`)
      .then((res) => {
        if (cancelled) return
        const result = res.data.data
        if (result && result.order) {
          setExistingOrder(result.order)
          setAddToExisting(true) // default to adding when an open order exists
        } else {
          setExistingOrder(null)
          setAddToExisting(false)
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setCheckingTable(false))
    return () => { cancelled = true }
  }, [tableId, orderType, isEditing])

  const filteredMenu = useMemo(() => {
    return menuItems.filter((m) => {
      const matchCat = activeCat === 'ALL' || m.category_id === activeCat
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [menuItems, activeCat, search])

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id && !c.special_instructions)
      if (existing) {
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

  const setLineNote = (idx: number, note: string) => {
    setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, special_instructions: note } : c)))
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  // ----- EDIT MODE (status / notes only) -----
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.patch(`/orders/${order!.id}`, {
        special_instructions: notes || undefined,
      })
      onSave(res.data.data)
      toast.success('Order updated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ----- CREATE / ADD MODE -----
  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one item')
      return
    }
    if (orderType === 'DINE_IN' && !tableId) {
      toast.error('Select a table for dine-in orders')
      return
    }

    setSaving(true)
    const items = cart.map((c) => ({
      menu_item_id: c.menu_item_id,
      quantity: c.quantity,
      special_instructions: c.special_instructions || undefined,
    }))

    // Snapshot cart lines for the KOT (so we can print without a refetch)
    const snapshot = cart.map((c) => ({
      menu_item_id: c.menu_item_id,
      menu_item_name: c.name,
      quantity: c.quantity,
      unit_price: c.price,
      special_instructions: c.special_instructions,
    }))

    try {
      if (addToExisting && existingOrder) {
        // Append to the running tab
        const res = await api.post(`/orders/${existingOrder.id}/items`, { items })
        toast.success(`Added ${cartCount} item${cartCount > 1 ? 's' : ''} to ${existingOrder.order_number}`)
        setPlacedOrder(res.data.data.order)
        setPlacedItems(snapshot)
      } else {
        const res = await api.post('/orders', {
          table_id: orderType === 'DINE_IN' ? tableId : undefined,
          order_type: orderType,
          order_source: orderSource,
          special_instructions: notes || undefined,
          items,
        })
        toast.success('Order created')
        setPlacedOrder(res.data.data.order)
        setPlacedItems(snapshot)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ============ EDIT MODE UI (compact) ============
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Edit Order {order!.order_number}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
            <div>
              <label className="form-label">Special Instructions</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="form-input resize-none"
                placeholder="Any notes for this order…"
              />
            </div>
            <p className="text-xs text-gray-500">
              To add more dishes, close this and use “Add Items” on the order.
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" fullWidth isLoading={saving}>
                Save Changes
              </Button>
              <Button type="button" variant="outline" fullWidth onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ============ SUCCESS STEP (after placing) — quick KOT print ============
  if (placedOrder) {
    // Attach the selected table so the KOT shows "TABLE x" instead of order type
    const selectedTable = tables.find((t) => t.id === tableId)
    const orderForPrint: Order = {
      ...placedOrder,
      table: selectedTable
        ? { id: selectedTable.id, table_number: Number(selectedTable.table_number) }
        : placedOrder.table ?? null,
    }
    const total = placedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { onSave(placedOrder); }} />
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl animate-slide-up p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mt-3">
            {addToExisting ? 'Items added' : 'Order placed'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {placedOrder.order_number}
            {selectedTable ? ` · Table ${selectedTable.table_number}` : ''}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-3">{formatCurrency(total)}</p>

          <div className="mt-6 space-y-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              leftIcon={<PrinterIcon className="w-5 h-5" />}
              onClick={() => printKOT(orderForPrint, placedItems as any, 'Kitchen')}
            >
              Print KOT
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => onSave(placedOrder)}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ============ CREATE / ADD MODE UI (full POS layout) ============
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-5xl bg-gray-50 shadow-2xl flex flex-col h-full animate-slide-up">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {addToExisting && existingOrder ? 'Add Items to Order' : 'New Order'}
            </h2>
            {addToExisting && existingOrder && (
              <p className="text-xs text-indigo-600 font-medium mt-0.5">
                Adding to {existingOrder.order_number}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {loadingData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* LEFT: menu picker */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
              {/* Order meta bar */}
              <div className="bg-white px-6 py-3 border-b border-gray-100 space-y-3">
                <div className="flex gap-2">
                  {ORDER_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setOrderType(t.value)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        orderType === t.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {orderType === 'DINE_IN' && (
                    <select
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select table…</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Table {t.table_number} ({t.seats} seats)
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={orderSource}
                    onChange={(e) => setOrderSource(e.target.value as OrderSource)}
                    className="form-select"
                  >
                    {ORDER_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <Input
                  placeholder="Search dishes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
                  fullWidth
                />

                {/* Category chips */}
                <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                  <button
                    onClick={() => setActiveCat('ALL')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                      activeCat === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCat(c.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                        activeCat === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu grid */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {filteredMenu.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No dishes found
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMenu.map((item) => {
                      const inCart = cart.find((c) => c.menu_item_id === item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className="relative text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-md transition-all group"
                        >
                          {inCart && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                              {inCart.quantity}
                            </span>
                          )}
                          <p className="font-medium text-gray-900 text-sm leading-tight pr-6">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.is_vegetarian && <span className="text-xs">🌱</span>}
                            <span className="text-xs text-gray-400">⏱ {item.prep_time_minutes}m</span>
                          </div>
                          <p className="text-base font-bold text-indigo-600 mt-2">
                            {formatCurrency(item.price)}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: cart */}
            <div className="w-64 lg:w-80 bg-white flex flex-col shrink-0">
              {/* Existing-order banner */}
              {checkingTable && (
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  Checking table…
                </div>
              )}
              {existingOrder && (
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800">
                        This table has an open order ({existingOrder.order_number})
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setAddToExisting(true)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            addToExisting
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          Add to it
                        </button>
                        <button
                          onClick={() => setAddToExisting(false)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            !addToExisting
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          New order
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cart header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <ShoppingCartIcon className="w-5 h-5 text-gray-400" />
                <span className="font-semibold text-gray-900 text-sm">
                  Cart {cartCount > 0 && `(${cartCount})`}
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="ml-auto text-xs text-red-500 hover:text-red-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
                    <ShoppingCartIcon className="w-10 h-10 text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">Tap dishes to add them</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {cart.map((line, idx) => (
                      <div key={`${line.menu_item_id}-${idx}`} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-tight">{line.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(line.price)} each</p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(line.price * line.quantity)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => changeQty(idx, -1)}
                              className="p-1.5 hover:bg-gray-100 text-gray-600"
                            >
                              <MinusIcon className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 text-sm font-medium w-8 text-center">{line.quantity}</span>
                            <button
                              onClick={() => changeQty(idx, 1)}
                              className="p-1.5 hover:bg-gray-100 text-gray-600"
                            >
                              <PlusIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={line.special_instructions || ''}
                            onChange={(e) => setLineNote(idx, e.target.value)}
                            placeholder="Note…"
                            className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart footer */}
              <div className="border-t border-gray-100 p-4 space-y-3">
                {!addToExisting && (
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Order note (optional)"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(cartTotal)}</span>
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  isLoading={saving}
                  disabled={cart.length === 0}
                  onClick={handleSubmit}
                  leftIcon={addToExisting ? <PlusIcon className="w-4 h-4" /> : <CheckBadgeIcon className="w-4 h-4" />}
                >
                  {addToExisting && existingOrder
                    ? `Add to ${existingOrder.order_number}`
                    : 'Place Order'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderForm
