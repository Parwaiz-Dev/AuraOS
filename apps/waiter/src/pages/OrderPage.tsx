/**
 * OrderPage — the main order-taking screen.
 * Menu grid on top, cart summary at bottom.
 * Supports both new orders and adding to existing orders.
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, MinusIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import { useMenuStore } from '../store/useMenuStore'
import { useCartStore } from '../store/useCartStore'
import { useOrderStore } from '../store/useOrderStore'
import { ordersApi } from '../api/endpoints'
import { getErrorMessage } from '../api/client'
import type { MenuItem } from '../types'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n)

const OrderPage: React.FC = () => {
  const navigate = useNavigate()
  const { orderId } = useParams<{ orderId?: string }>()  // set when adding to existing order
  const [searchParams] = useSearchParams()
  const tableLabel = searchParams.get('table')

  const isAddMode = !!orderId

  const { categories, items, fetchAll } = useMenuStore()
  const { cart, tableNumber, orderType, notes, addItem, changeQty, setNotes, clear, total, count } = useCartStore()
  const { submitOrder } = useOrderStore()

  const [activeCat, setActiveCat] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchCat = activeCat === 'ALL' || item.category_id === activeCat
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [items, activeCat, search])

  const handleAdd = (item: MenuItem) => {
    addItem({ menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 })
  }

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Add at least one item'); return }
    setSubmitting(true)

    try {
      if (isAddMode && orderId) {
        // Add items to existing order
        await ordersApi.addItems(orderId, cart)
        toast.success(`Added ${count()} item(s) to order`)
        clear()
        navigate('/orders')
      } else {
        // Create new order (supports offline queue)
        const { tableId } = useCartStore.getState()
        const order = await submitOrder({
          table_id:    tableId,
          order_type:  orderType,
          order_source: 'WAITER',
          special_instructions: notes || undefined,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            quantity: c.quantity,
            special_instructions: c.special_instructions,
          })),
        })

        if (order) {
          toast.success(`Order ${order.order_number} created`)
        } else {
          toast.success('Order queued — will sync when online', { icon: '📶' })
        }
        clear()
        navigate('/orders')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const cartCount = count()
  const cartTotal = total()

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">
              {isAddMode ? 'Add Items' : 'New Order'}
            </h1>
            <p className="text-xs text-gray-500">
              {isAddMode
                ? `Adding to order · Table ${tableLabel || ''}`
                : tableNumber ? `Table ${tableNumber}` : orderType}
            </p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search dishes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input mt-2 text-sm"
        />

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto mt-2 pb-1 scrollbar-none">
          {['ALL', ...categories.map((c) => c.name)].map((cat) => {
            const catId = cat === 'ALL' ? 'ALL' : categories.find((c) => c.name === cat)?.id || cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(catId)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeCat === catId
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.map((item) => {
          const inCart = cart.find((c) => c.menu_item_id === item.id)
          return (
            <div key={item.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {item.is_vegetarian && (
                    <span className="w-3.5 h-3.5 rounded border-2 border-emerald-500 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                </div>
                <p className="text-indigo-600 font-bold text-sm mt-0.5">{formatCurrency(item.price)}</p>
              </div>

              {inCart ? (
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden shrink-0">
                  <button
                    onClick={() => changeQty(item.id, -1)}
                    className="px-3 py-2 hover:bg-gray-100 text-gray-600"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-sm min-w-[24px] text-center">{inCart.quantity}</span>
                  <button
                    onClick={() => handleAdd(item)}
                    className="px-3 py-2 hover:bg-gray-100 text-gray-600"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAdd(item)}
                  className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Order notes */}
      {!isAddMode && (
        <div className="px-4 pb-2 shrink-0">
          <input
            type="text"
            placeholder="Order note (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input text-sm"
          />
        </div>
      )}

      {/* Submit bar */}
      <div className="px-4 pb-6 pt-2 shrink-0 bg-white border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={submitting || cartCount === 0}
          className="btn-primary w-full flex items-center justify-between"
        >
          <span className="bg-indigo-500 rounded-lg px-2 py-0.5 text-sm">{cartCount}</span>
          <span>{isAddMode ? 'Add to Order' : 'Place Order'}</span>
          <span>{formatCurrency(cartTotal)}</span>
        </button>
      </div>
    </div>
  )
}

export default OrderPage
