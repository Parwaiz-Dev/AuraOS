/**
 * CustomerApp — public QR ordering page.
 * No login required. Supports two modes:
 *   - restaurant: customer enters table number, pays at counter
 *   - mall:       customer enters name + phone, picks payment method
 *
 * URL: /customer?slug=demo-kitchen
 */

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { MenuItem, MenuCategory } from '../types/menu'
import { formatCurrency } from '../lib/utils'
import {
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

// ── Dedicated public API — no auth token, no logout interceptor ──────────────
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 15000,
})

type QRMode = 'restaurant' | 'mall'
type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'ONLINE'
type Step = 'info' | 'menu' | 'cart' | 'confirm'

// ── Modifier types ───────────────────────────────────────────────────────────

interface ModifierOption {
  id: string
  name: string
  price_adjustment: number
  sort_order: number
}

interface ModifierGroup {
  id: string
  name: string
  selection_type: 'single' | 'multiple'
  min_select: number
  max_select: number
  sort_order: number
  options: ModifierOption[]
}

interface SelectedModifier {
  group_id: string
  group_name: string
  option_id: string
  option_name: string
  price_adjustment: number
}

interface CartLine {
  cart_key: string         // composite key for unique cart identity
  id: string               // menu_item_id
  name: string
  price: number            // base unit price (excl modifiers)
  quantity: number
  is_vegetarian: boolean
  modifiers: SelectedModifier[]
}

interface Table {
  id: string
  table_number: string
  seats: number
}

interface OrderConfirmation {
  order_number: string
  total_amount: number
  items_count: number
  payment_method: PaymentMethod
  qr_mode: QRMode
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; desc: string }[] = [
  { value: 'UPI',    label: 'UPI',           icon: '📱', desc: 'Google Pay, PhonePe, Paytm' },
  { value: 'CARD',   label: 'Card',          icon: '💳', desc: 'Debit or Credit card' },
  { value: 'ONLINE', label: 'Online',        icon: '🌐', desc: 'Net banking / Wallet' },
  { value: 'CASH',   label: 'Pay at Counter',icon: '💵', desc: 'Pay when you collect' },
]

// ─────────────────────────────────────────────────────────────────────────────

const CustomerApp: React.FC = () => {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get('slug') || 'demo-kitchen'

  // Data
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [qrMode, setQrMode] = useState<QRMode>('restaurant')
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Customer info (restaurant mode)
  const [tableId, setTableId] = useState<string>('')
  const [tableNumber, setTableNumber] = useState<string>('')

  // Customer info (mall mode)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')

  // Menu
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])

  // Modifier selection modal
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null)
  const [modifierSelections, setModifierSelections] = useState<Record<string, string | string[]>>({})

  // UI state
  const [step, setStep] = useState<Step>('info')
  const [cartOpen, setCartOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null)
  const [infoError, setInfoError] = useState('')

  // ── Build a flat modifier options lookup from the menu items ────────────────
  const itemModifierGroups = useMemo(() => {
    const map: Record<string, ModifierGroup[]> = {}
    for (const item of items) {
      if ((item as any).modifier_groups && (item as any).modifier_groups.length > 0) {
        map[item.id] = (item as any).modifier_groups
      }
    }
    return map
  }, [items])

  // ── Load menu + tables ─────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      publicApi.get(`/public/menu/${slug}`),
      publicApi.get(`/public/tables/${slug}`),
    ])
      .then(([menuRes, tablesRes]) => {
        const data = menuRes.data.data
        setRestaurantName(data.restaurant.name)
        setQrMode(data.restaurant.qr_mode || 'restaurant')
        setCategories(data.categories || [])
        setItems(data.items || [])
        setTables(tablesRes.data.data || [])
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load menu')
      })
      .finally(() => setLoading(false))
  }, [slug])

  // ── Filtered menu ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchCat = selectedCategory === 'ALL' || item.category_id === selectedCategory
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [items, selectedCategory, search])

  // ── Generate a composite cart key from item + modifier selections ───────────
  const makeCartKey = (itemId: string, mods: SelectedModifier[]): string => {
    if (mods.length === 0) return itemId
    const sorted = [...mods].map((m) => m.option_id).sort()
    return `${itemId}::${sorted.join(',')}`
  }

  // ── Calculate total price with modifiers ────────────────────────────────────
  const getEffectivePrice = (item: MenuItem, mods: SelectedModifier[]): number => {
    const modAdjustment = mods.reduce((sum, m) => sum + m.price_adjustment, 0)
    return item.price + modAdjustment
  }

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addToCart = (item: MenuItem, mods: SelectedModifier[] = []) => {
    const cartKey = makeCartKey(item.id, mods)
    const effectivePrice = getEffectivePrice(item, mods)
    setCart((prev) => {
      const ex = prev.find((c) => c.cart_key === cartKey)
      if (ex) return prev.map((c) => (c.cart_key === cartKey ? { ...c, quantity: c.quantity + 1 } : c))
      return [...prev, {
        cart_key: cartKey,
        id: item.id,
        name: item.name,
        price: effectivePrice,
        quantity: 1,
        is_vegetarian: item.is_vegetarian,
        modifiers: mods,
      }]
    })
  }

  const changeQty = (cartKey: string, delta: number) => {
    setCart((prev) => prev.map((c) => (c.cart_key === cartKey ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0))
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const tax = cartTotal * 0.18

  // ── Modifier selection helpers ─────────────────────────────────────────────
  const openModifierModal = (item: MenuItem) => {
    setModifierItem(item)
    const groups = itemModifierGroups[item.id] || []
    const init: Record<string, string | string[]> = {}
    for (const g of groups) {
      init[g.id] = g.selection_type === 'single' ? '' : []
    }
    setModifierSelections(init)
  }

  const toggleModifierOption = (groupId: string, optionId: string, selectionType: 'single' | 'multiple') => {
    setModifierSelections((prev) => {
      if (selectionType === 'single') {
        return { ...prev, [groupId]: prev[groupId] === optionId ? '' : optionId }
      }
      // multiple
      const current = (prev[groupId] as string[]) || []
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) }
      }
      return { ...prev, [groupId]: [...current, optionId] }
    })
  }

  const confirmModifiers = () => {
    if (!modifierItem) return
    const groups = itemModifierGroups[modifierItem.id] || []

    // Validate selections
    for (const g of groups) {
      const sel = modifierSelections[g.id]
      if (g.selection_type === 'single') {
        const selected = (sel as string) || ''
        if (g.min_select > 0 && !selected) {
          setError(`Please select an option for "${g.name}"`)
          return
        }
      } else {
        const selected = (sel as string[]) || []
        if (selected.length < g.min_select) {
          setError(`Please select at least ${g.min_select} option(s) for "${g.name}"`)
          return
        }
        if (g.max_select > 0 && selected.length > g.max_select) {
          setError(`Please select at most ${g.max_select} option(s) for "${g.name}"`)
          return
        }
      }
    }

    // Build SelectedModifier[] from selections
    const selectedMods: SelectedModifier[] = []
    for (const g of groups) {
      const sel = modifierSelections[g.id]
      const optionIds = g.selection_type === 'single' ? (sel ? [sel as string] : []) : (sel as string[] || [])

      for (const optId of optionIds) {
        const opt = g.options.find((o) => o.id === optId)
        if (opt) {
          selectedMods.push({
            group_id: g.id,
            group_name: g.name,
            option_id: opt.id,
            option_name: opt.name,
            price_adjustment: opt.price_adjustment,
          })
        }
      }
    }

    setError('')
    addToCart(modifierItem, selectedMods)
    setModifierItem(null)
    setModifierSelections({})
  }

  // ── Validate info step ─────────────────────────────────────────────────────
  const handleInfoNext = () => {
    setInfoError('')
    if (qrMode === 'restaurant') {
      if (!tableNumber.trim() && !tableId) {
        setInfoError('Please select or enter your table number')
        return
      }
    } else {
      if (!customerName.trim()) { setInfoError('Please enter your name'); return }
      if (!customerPhone.trim()) { setInfoError('Please enter your phone number'); return }
      if (customerPhone.replace(/\D/g, '').length < 10) { setInfoError('Please enter a valid 10-digit phone number'); return }
    }
    setStep('menu')
  }

  // ── Place order ────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return
    setPlacing(true)
    setError('')
    try {
      const body: any = {
        items: cart.map((c) => ({
          menu_item_id: c.id,
          quantity: c.quantity,
          modifiers: c.modifiers.map((m) => ({
            modifier_group_id: m.group_id,
            modifier_group_name: m.group_name,
            modifier_option_id: m.option_id,
            modifier_option_name: m.option_name,
            price_adjustment: m.price_adjustment,
          })),
        })),
      }
      if (qrMode === 'restaurant') {
        if (tableId) body.table_id = tableId
        body.table_number = tableNumber || tables.find((t) => t.id === tableId)?.table_number
      } else {
        body.customer_name = customerName
        body.customer_phone = customerPhone
        body.payment_method = paymentMethod
      }

      const res = await publicApi.post(`/public/order/${slug}`, body)
      const data = res.data.data

      if (data.razorpay) {
        await openRazorpayCheckout(data)
        return
      }

      setConfirmation(data)
      setCart([])
      setCartOpen(false)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to place order')
    } finally {
      setPlacing(false)
    }
  }

  const openRazorpayCheckout = async (orderData: any): Promise<void> => {
    if (!(window as any).Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.head.appendChild(script)
      })
    }

    const rz = orderData.razorpay

    return new Promise((resolve) => {
      const options = {
        key:         rz.key_id,
        amount:      rz.amount,
        currency:    rz.currency,
        name:        restaurantName,
        description: `Order ${orderData.order_number}`,
        order_id:    rz.razorpay_order_id,
        prefill: {
          name:    customerName  || '',
          contact: customerPhone || '',
        },
        theme: { color: '#4f46e5' },

        handler: async (response: any) => {
          try {
            await publicApi.post('/public/verify-payment', {
              order_id:            orderData.order_id,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            })
            setConfirmation({ ...orderData, payment_method: paymentMethod })
            setCart([])
            setCartOpen(false)
            resolve()
          } catch (err: any) {
            setError('Payment verified but confirmation failed. Please contact staff.')
            resolve()
          } finally {
            setPlacing(false)
          }
        },

        modal: {
          ondismiss: () => {
            setError('Payment cancelled. You can try again.')
            setPlacing(false)
            resolve()
          },
        },
      }

      const rzInstance = new (window as any).Razorpay(options)
      rzInstance.open()
    })
  }

  // ── Calculate modifier summary for display ─────────────────────────────────
  const getModifierSummary = (mods: SelectedModifier[]): string => {
    if (mods.length === 0) return ''
    return mods.map((m) => `${m.option_name}${m.price_adjustment > 0 ? ` (+${formatCurrency(m.price_adjustment)})` : ''}`).join(', ')
  }

  // ── Order confirmation ─────────────────────────────────────────────────────
  if (confirmation) {
    const isPaid = confirmation.payment_method !== 'CASH'
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircleIcon className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Order Placed!</h1>
          <p className="text-gray-500 text-sm mb-6">
            {isPaid ? 'Your payment is being processed.' : 'Your order has been sent to the kitchen.'}
          </p>

          <div className="bg-gray-50 rounded-2xl p-5 space-y-3 mb-6 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order #</span>
              <span className="font-bold text-indigo-600 font-mono">{confirmation.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items</span>
              <span className="font-medium">{confirmation.items_count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment</span>
              <span className="font-medium">
                {PAYMENT_OPTIONS.find((p) => p.value === confirmation.payment_method)?.label || confirmation.payment_method}
              </span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-3">
              <span>Total</span>
              <span>{formatCurrency(Number(confirmation.total_amount) * 1.18)}</span>
            </div>
          </div>

          {!isPaid && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-700">
              💵 Please pay <strong>{formatCurrency(Number(confirmation.total_amount) * 1.18)}</strong> at the counter when collecting your order.
            </div>
          )}

          <button
            onClick={() => { setConfirmation(null); setStep('info'); setCart([]) }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
          >
            Order More
          </button>
        </div>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading menu…</p>
        </div>
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium">
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 1: Info collection ────────────────────────────────────────────────
  if (step === 'info') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">{qrMode === 'restaurant' ? '🍽️' : '🛍️'}</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{restaurantName}</h1>
            <p className="text-indigo-200 text-sm mt-1">
              {qrMode === 'restaurant' ? 'Dine-in ordering' : 'Food court ordering'}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {qrMode === 'restaurant' ? (
              <>
                <div>
                  <label className="form-label">Select Your Table</label>
                  {tables.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {tables.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setTableId(t.id); setTableNumber(t.table_number) }}
                          className={`py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${
                            tableId === t.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {t.table_number}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. T1, T2, Table 5"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="form-input w-full mt-1"
                    />
                  )}
                  {tables.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Or type manually:</p>
                      <input
                        type="text"
                        placeholder="Table number"
                        value={tableNumber}
                        onChange={(e) => { setTableNumber(e.target.value); setTableId('') }}
                        className="form-input w-full text-sm"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Your Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="form-input w-full mt-1"
                  />
                </div>
                <div>
                  <label className="form-label">Phone Number <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="form-input w-full mt-1"
                  />
                </div>
                <div>
                  <label className="form-label">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPaymentMethod(opt.value)}
                        className={`p-3 text-left rounded-xl border-2 transition-colors ${
                          paymentMethod === opt.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <p className="text-xs font-semibold text-gray-900 mt-1">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {infoError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{infoError}</p>
            )}

            <button
              onClick={handleInfoNext}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              View Menu
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP 2: Menu ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">{restaurantName}</h1>
            <p className="text-xs text-gray-400">
              {qrMode === 'restaurant'
                ? `Table: ${tableNumber || 'Not selected'}`
                : customerName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('info')}
              className="text-xs text-indigo-600 hover:underline"
            >
              Change
            </button>
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 bg-indigo-600 rounded-full"
            >
              <ShoppingCartIcon className="w-5 h-5 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto px-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search dishes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Menu items */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No items found</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const hasModifiers = itemModifierGroups[item.id] && itemModifierGroups[item.id].length > 0
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.is_vegetarian && (
                        <span className="w-4 h-4 rounded border-2 border-emerald-500 flex items-center justify-center shrink-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </span>
                      )}
                      <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                      {hasModifiers && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Customisable</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold text-indigo-600">{formatCurrency(item.price)}</span>
                      <span className="text-xs text-gray-400">⏱ {item.prep_time_minutes}m</span>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => {
                        if (hasModifiers) {
                          openModifierModal(item)
                        } else {
                          addToCart(item)
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Sticky bottom bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 inset-x-0 p-4 z-10">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-semibold flex items-center justify-between px-6 shadow-xl"
            >
              <span className="bg-indigo-500 rounded-lg px-2 py-0.5 text-sm">{cartCount}</span>
              <span>View Order</span>
              <span>{formatCurrency(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Your Order</h2>
              <button onClick={() => setCartOpen(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cart.map((line) => {
                const modSummary = getModifierSummary(line.modifiers)
                return (
                  <div key={line.cart_key} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{line.name}</p>
                      {modSummary && (
                        <p className="text-xs text-gray-400 mt-0.5">{modSummary}</p>
                      )}
                      <p className="text-xs text-gray-400">{formatCurrency(line.price)} each</p>
                    </div>
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => changeQty(line.cart_key, -1)} className="px-3 py-2 hover:bg-gray-100 text-gray-600">
                        <MinusIcon className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 font-bold text-sm min-w-[24px] text-center">{line.quantity}</span>
                      <button onClick={() => changeQty(line.cart_key, 1)} className="px-3 py-2 hover:bg-gray-100 text-gray-600">
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                      {formatCurrency(line.price * line.quantity)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="px-6 py-5 border-t border-gray-100 space-y-3">
              {/* Summary */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>GST (18%)</span><span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2">
                  <span>Total</span><span>{formatCurrency(cartTotal + tax)}</span>
                </div>
              </div>

              {/* Payment method reminder for mall mode */}
              {qrMode === 'mall' && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 text-sm">
                  <span className="text-xl">{PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)?.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)?.label}</p>
                    <button onClick={() => { setCartOpen(false); setStep('info') }} className="text-xs text-indigo-600 hover:underline">
                      Change payment method
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button
                onClick={handlePlaceOrder}
                disabled={placing || cart.length === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {placing ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Place Order · {formatCurrency(cartTotal + tax)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modifier Selection Modal ─────────────────────────────────────────── */}
      {modifierItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setModifierItem(null); setError('') }} />
          <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{modifierItem.name}</h2>
                <p className="text-sm text-gray-400">Customise your order</p>
              </div>
              <button
                onClick={() => { setModifierItem(null); setError('') }}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modifier groups */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {(itemModifierGroups[modifierItem.id] || []).map((group) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
                    {group.selection_type === 'single' ? (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {group.min_select > 0 ? 'Required' : 'Optional'} · Pick one
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        Pick up to {group.max_select}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {group.options.map((opt) => {
                      const sel = modifierSelections[group.id]
                      const isSelected = group.selection_type === 'single'
                        ? (sel as string) === opt.id
                        : ((sel as string[]) || []).includes(opt.id)

                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleModifierOption(group.id, opt.id, group.selection_type)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            group.selection_type === 'single' ? 'rounded-full' : 'rounded'
                          } ${
                            isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <CheckCircleIcon className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{opt.name}</p>
                          </div>
                          {opt.price_adjustment > 0 && (
                            <span className="text-sm font-medium text-gray-500">+{formatCurrency(opt.price_adjustment)}</span>
                          )}
                          {opt.price_adjustment === 0 && (
                            <span className="text-xs text-gray-400">Included</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 space-y-2">
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button
                onClick={confirmModifiers}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerApp
