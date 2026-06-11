/**
 * Owner Dashboard — Complete SaaS Admin Panel (like Petpooja).
 *
 * Tabs:
 *   Dashboard   — MRR, counts, overview
 *   Restaurants — all restaurants, search, click for detail
 *   Inquiries   — "Book a Demo" form submissions
 *   Support     — tickets from restaurants
 *   Create      — onboard a new restaurant
 */
import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { subscriptionApi, getErrorMessage } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { PlatformMetrics } from '../types/subscription'
import Card from '../components/Card'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Input from '../components/Input'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, formatRelative } from '../lib/utils'
import { DEFAULT_FEATURES_BY_TYPE, type RestaurantType } from '../config/restaurantTypes'
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  BanknotesIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  CurrencyDollarIcon,
  PlusIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

type Tab = 'dashboard' | 'restaurants' | 'create' | 'inquiries' | 'support' | 'monitoring'

const OwnerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')
  const navigate = useNavigate()

  useEffect(() => {
    if (tab === 'monitoring') {
      navigate('/owner/monitoring');
    }
  }, [tab, navigate]);

  if (user && !user.isSuperAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">AuraOS Owner · Manage all restaurants</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {([
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'restaurants', label: '🏪 Restaurants' },
          { id: 'create', label: '➕ Create' },
          { id: 'inquiries', label: '📩 Inquiries' },
          { id: 'support', label: '💬 Support' },
          { id: 'monitoring', label: '📡 Monitoring' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'restaurants' && <RestaurantsTab />}
      {tab === 'create' && <CreateTab onCreated={() => setTab('restaurants')} />}
      {tab === 'inquiries' && <InquiriesTab />}
      {tab === 'support' && <SupportTab />}
    </div>
  )
}

export default OwnerDashboard


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
const DashboardTab: React.FC = () => {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    subscriptionApi.getPlatformMetrics()
      .then((r) => setMetrics(r.data.data))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading text="Loading metrics…" />
  if (!metrics) return (
    <EmptyState
      icon={<BanknotesIcon className="w-7 h-7" />}
      title="No metrics available"
      description="Platform metrics could not be loaded. Please try again later."
    />
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card className="surface-brand text-white border-0" padding="sm">
        <BanknotesIcon className="w-6 h-6 text-white/60 mb-1" />
        <p className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</p>
        <p className="text-xs text-white/70">Monthly Revenue</p>
      </Card>
      <Card padding="sm">
        <BuildingStorefrontIcon className="w-6 h-6 text-brand-500 mb-1" />
        <p className="text-2xl font-bold text-slate-900">{metrics.total_restaurants}</p>
        <p className="text-xs text-slate-500">Total Restaurants</p>
      </Card>
      <Card padding="sm">
        <CheckCircleIcon className="w-6 h-6 text-emerald-500 mb-1" />
        <p className="text-2xl font-bold text-slate-900">{metrics.active_subscriptions}</p>
        <p className="text-xs text-slate-500">Active Subscriptions</p>
      </Card>
      <Card padding="sm">
        <DocumentTextIcon className="w-6 h-6 text-amber-500 mb-1" />
        <p className="text-2xl font-bold text-slate-900">{metrics.outstanding_invoices}</p>
        <p className="text-xs text-slate-500">Unpaid Invoices ({formatCurrency(metrics.outstanding_amount)})</p>
      </Card>
      <Card padding="sm">
        <p className="text-2xl font-bold text-blue-600">{metrics.trial_accounts}</p>
        <p className="text-xs text-slate-500">On Trial</p>
      </Card>
      <Card padding="sm">
        <p className="text-2xl font-bold text-amber-600">{metrics.grace_period_accounts}</p>
        <p className="text-xs text-slate-500">Grace Period</p>
      </Card>
      <Card padding="sm">
        <p className="text-2xl font-bold text-red-600">{metrics.suspended_accounts}</p>
        <p className="text-xs text-slate-500">Suspended</p>
      </Card>
      <Card padding="sm">
        <p className="text-2xl font-bold text-slate-400">{metrics.cancelled_accounts}</p>
        <p className="text-xs text-slate-500">Cancelled</p>
      </Card>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Restaurants (list + detail modal)
// ═══════════════════════════════════════════════════════════════════════════════
const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  TRIAL: { variant: 'info', label: 'Trial' }, ACTIVE: { variant: 'success', label: 'Active' },
  GRACE_PERIOD: { variant: 'warning', label: 'Grace' }, SUSPENDED: { variant: 'error', label: 'Suspended' },
  CANCELLED: { variant: 'error', label: 'Cancelled' }, NONE: { variant: 'default', label: 'No sub' },
}

const RestaurantsTab: React.FC = () => {
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [detail, setDetail] = useState<any>(null)
  const [, setBusy] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      const r = await subscriptionApi.getAllRestaurants({ search: search || undefined, status: statusFilter !== 'ALL' ? statusFilter : undefined })
      setRestaurants(r.data.data || [])
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { fetch() }, [fetch])

  const loadDetail = async (id: string) => {
    try {
      const r = await api.get(`/admin/restaurants/${id}`)
      setDetail(r.data.data)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspend this restaurant?')) return
    setBusy(id)
    try { await subscriptionApi.adminSuspend(id); toast.success('Suspended'); fetch() }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setBusy(null) }
  }

  const handleActivate = async (id: string) => {
    setBusy(id)
    try { await subscriptionApi.adminActivate(id); toast.success('Activated (30 days)'); fetch() }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setBusy(null) }
  }

  const handleInvoice = async (id: string, name: string) => {
    const amt = prompt(`Invoice amount for ${name} (₹):`)
    if (!amt) return
    const amount = parseFloat(amt)
    if (!amount || amount <= 0) { toast.error('Invalid amount'); return }
    try { await subscriptionApi.adminGenerateInvoice(id, amount); toast.success('Invoice created'); fetch() }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  const toggleFeature = async (restaurantId: string, key: string, current: boolean) => {
    try {
      await api.put(`/admin/restaurants/${restaurantId}/features`, { features: { [key]: !current } })
      toast.success(`Feature ${!current ? 'enabled' : 'disabled'}`)
      await loadDetail(restaurantId)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <Loading text="Loading restaurants…" />

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input placeholder="Search restaurant…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />} fullWidth />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select min-w-[140px]">
          <option value="ALL">All</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="GRACE_PERIOD">Grace</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Restaurant</th><th>Plan</th><th>Status</th><th>Users</th><th>Orders</th><th>Revenue</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {restaurants.map((r) => {
                const badge = STATUS_BADGE[r.subscription_status] || STATUS_BADGE.NONE
                return (
                  <tr key={r.id}>
                    <td><p className="font-semibold text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.slug}</p></td>
                    <td className="text-sm">{r.plan_name}{r.plan_price > 0 && <span className="text-xs text-slate-400 ml-1">₹{r.plan_price}</span>}</td>
                    <td><Badge variant={badge.variant} dot>{badge.label}</Badge></td>
                    <td>{r.user_count}</td>
                    <td>{r.orders_today}</td>
                    <td className="font-medium">{formatCurrency(r.revenue_today)}</td>
                    <td className="text-xs text-slate-400">{formatDate(r.created_at)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => loadDetail(r.id)} title="View Detail" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><EyeIcon className="w-4 h-4" /></button>
                        {!['SUSPENDED','CANCELLED'].includes(r.subscription_status) && <button onClick={() => handleSuspend(r.id)} title="Suspend" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><PauseCircleIcon className="w-4 h-4" /></button>}
                        {['SUSPENDED','TRIAL','GRACE_PERIOD'].includes(r.subscription_status) && <button onClick={() => handleActivate(r.id)} title="Activate" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><PlayCircleIcon className="w-4 h-4" /></button>}
                        <button onClick={() => handleInvoice(r.id, r.name)} title="Invoice" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><CurrencyDollarIcon className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail modal */}
      {detail && (
        <Modal isOpen onClose={() => setDetail(null)} title={detail.name} size="lg">
          <div className="space-y-5 max-h-[75vh] overflow-y-auto">

            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Slug:</span> <span className="font-mono text-xs">{detail.slug}</span></div>
              <div><span className="text-slate-500">Joined:</span> {formatDate(detail.created_at)}</div>
              <div><span className="text-slate-500">Orders today:</span> {detail.stats?.total_orders ?? '—'}</div>
              <div><span className="text-slate-500">Revenue today:</span> {formatCurrency(parseFloat(detail.stats?.total_revenue || 0))}</div>
            </div>

            {/* ── Restaurant Type ───────────────────────────────────── */}
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 text-sm">Restaurant Type</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {([
                  { value: 'FULL_SERVICE',  label: '🍽️ Full Service',    desc: 'Sit-down, table service' },
                  { value: 'QSR_SIMPLE',    label: '⚡ QSR Simple',      desc: 'Small counter, token queue' },
                  { value: 'QSR_CHAIN',     label: '🏪 QSR Chain',       desc: "McDonald's / KFC style" },
                  { value: 'CAFE',          label: '☕ Café',             desc: 'Counter + some seating' },
                  { value: 'CLOUD_KITCHEN', label: '📦 Cloud Kitchen',   desc: 'Delivery only' },
                  { value: 'HYBRID',        label: '🔀 Hybrid',          desc: 'Dine-in + takeaway + delivery' },
                ] as { value: string; label: string; desc: string }[]).map((t) => (
                  <button
                    key={t.value}
                    onClick={async () => {
                      try {
                        await api.put(`/restaurants/${detail.id}/settings`, { restaurant_type: t.value })
                        setDetail((d: any) => ({ ...d, restaurant_type: t.value }))
                        toast.success(`Type set to ${t.label}`)
                      } catch (e) { toast.error(getErrorMessage(e)) }
                    }}
                    className={`text-left p-2.5 rounded-xl border-2 transition-all text-sm ${
                      detail.restaurant_type === t.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <p className="font-semibold leading-tight">{t.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── QSR Settings ─────────────────────────────────────── */}
            {['QSR_SIMPLE','QSR_CHAIN'].includes(detail.restaurant_type) && (
              <div className="space-y-2">
                <p className="font-semibold text-slate-700 text-sm">QSR / Token Settings</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Token Prefix</label>
                    <input
                      type="text"
                      maxLength={10}
                      defaultValue={detail.token_prefix || 'T'}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      onBlur={async (e) => {
                        try {
                          await api.put(`/restaurants/${detail.id}/settings`, { token_prefix: e.target.value || 'T' })
                          setDetail((d: any) => ({ ...d, token_prefix: e.target.value || 'T' }))
                        } catch (err) { toast.error(getErrorMessage(err)) }
                      }}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={detail.qsr_enabled ?? false}
                        onChange={async (e) => {
                          try {
                            await api.put(`/restaurants/${detail.id}/settings`, { qsr_enabled: e.target.checked })
                            setDetail((d: any) => ({ ...d, qsr_enabled: e.target.checked }))
                            toast.success(e.target.checked ? 'QSR mode enabled' : 'QSR mode disabled')
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600"
                      />
                      <span>QSR Mode Active</span>
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={detail.token_daily_reset ?? true}
                        onChange={async (e) => {
                          try {
                            await api.put(`/restaurants/${detail.id}/settings`, { token_daily_reset: e.target.checked })
                            setDetail((d: any) => ({ ...d, token_daily_reset: e.target.checked }))
                          } catch (err) { toast.error(getErrorMessage(err)) }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600"
                      />
                      <span>Reset daily</span>
                    </label>
                  </div>
                </div>
                {detail.qsr_enabled && (
                  <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    ✓ Tokens will be generated as {detail.token_prefix || 'T'}-001, {detail.token_prefix || 'T'}-002… on every new order
                  </p>
                )}
              </div>
            )}

            {/* ── Features ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 text-sm">Features</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { key: 'kitchen_display', label: '🖥️ Kitchen Display' },
                  { key: 'inventory',       label: '📦 Inventory' },
                  { key: 'reports',         label: '📊 Reports' },
                  { key: 'qr_ordering',     label: '📱 QR Ordering' },
                  { key: 'whatsapp',        label: '💬 WhatsApp' },
                  { key: 'zomato',          label: '🟠 Zomato' },
                  { key: 'payments',        label: '💳 Payments' },
                  { key: 'waiter_app',      label: '👨‍🍳 Waiter App' },
                ] as { key: string; label: string }[]).map(({ key, label }) => {
                  const enabled = (detail.features || {})[key] !== false
                  return (
                    <button
                      key={key}
                      onClick={() => toggleFeature(detail.id, key, enabled)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border-2 text-sm transition-all ${
                        enabled
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      <span>{label}</span>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Subscription ─────────────────────────────────────── */}
            {detail.subscription && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-slate-700 mb-1">Subscription</p>
                <div className="flex items-center gap-3">
                  <Badge variant={(STATUS_BADGE[detail.subscription.status] || STATUS_BADGE.NONE).variant}>
                    {detail.subscription.status}
                  </Badge>
                  <span className="text-slate-500">Plan: {detail.subscription.plan_name || 'None'}</span>
                </div>
              </div>
            )}

            {/* ── Users ────────────────────────────────────────────── */}
            {detail.users?.length > 0 && (
              <div>
                <p className="font-semibold text-slate-700 text-sm mb-2">Users ({detail.users.length})</p>
                <div className="space-y-1">
                  {detail.users.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between text-sm px-2 py-1 bg-slate-50 rounded-lg">
                      <span>{u.name} <span className="text-slate-400">({u.email})</span></span>
                      <Badge variant="default">{u.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Create Restaurant
// ═══════════════════════════════════════════════════════════════════════════════
const FEATURE_OPTIONS = [
  { key: 'kitchen_display', label: 'Kitchen Display' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'reports', label: 'Reports' },
  { key: 'qr_ordering', label: 'QR Ordering' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'zomato', label: 'Zomato' },
  { key: 'payments', label: 'Payments' },
  { key: 'waiter_app', label: 'Waiter App' },
]

const RESTAURANT_TYPES = [
  { value: 'FULL_SERVICE',  label: '🍽️ Full Service',    desc: 'Sit-down, table service' },
  { value: 'QSR_SIMPLE',    label: '⚡ QSR Simple',      desc: 'Small counter, token queue' },
  { value: 'QSR_CHAIN',     label: '🏪 QSR Chain',       desc: "McDonald's / KFC style" },
  { value: 'CAFE',          label: '☕ Café',             desc: 'Counter + some seating' },
  { value: 'CLOUD_KITCHEN', label: '📦 Cloud Kitchen',   desc: 'Delivery only' },
  { value: 'HYBRID',        label: '🔀 Hybrid',          desc: 'Dine-in + takeaway + delivery' },
]

const CreateTab: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminName, setAdminName] = useState('')
  const [restaurantType, setRestaurantType] = useState('FULL_SERVICE')
  const [features, setFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURE_OPTIONS.map((f) => [f.key, true]))
  )
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)

  const toggleFeature = (key: string) => setFeatures((p) => ({ ...p, [key]: !p[key] }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !adminName) { toast.error('Fill all fields'); return }
    setSaving(true)
    try {
      const res = await api.post('/admin/create-restaurant', {
        restaurant_name: name,
        admin_email: email,
        admin_password: password,
        admin_name: adminName,
        restaurant_type: restaurantType,
        features,
      })
      setResult(res.data.data)
      toast.success('Restaurant created!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  if (result) {
    return (
      <Card>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Restaurant Created!</h2>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-2 max-w-sm mx-auto">
            <p><span className="text-slate-500">Restaurant:</span> <span className="font-semibold">{result.restaurant.name}</span></p>
            <p><span className="text-slate-500">Admin Email:</span> <span className="font-mono">{result.admin.email}</span></p>
            <p><span className="text-slate-500">Password:</span> <span className="font-mono">(as you entered)</span></p>
            <p><span className="text-slate-500">Login URL:</span> <span className="font-mono text-brand-600">http://your-domain/login</span></p>
          </div>
          <p className="text-xs text-slate-400">Give these credentials to the restaurant owner. They can log in and start using AuraOS.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="primary" onClick={() => { setResult(null); setName(''); setEmail(''); setPassword(''); setAdminName('') }}>Create Another</Button>
            <Button variant="outline" onClick={onCreated}>View Restaurants</Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Onboard New Restaurant</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Restaurant Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth placeholder="e.g. Spice Garden" />
          <Input label="Admin Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} required fullWidth placeholder="Owner's name" />
          <Input label="Admin Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth placeholder="owner@restaurant.com" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth placeholder="Min 6 characters" />
        </div>

        <div>
          <p className="form-label">Restaurant Type</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {RESTAURANT_TYPES.map((t) => (
              <button
                key={t.value} type="button"
                onClick={() => {
                  setRestaurantType(t.value)
                  setFeatures({ ...DEFAULT_FEATURES_BY_TYPE[t.value as RestaurantType] })
                }}
                className={`text-left p-2.5 rounded-xl border-2 transition-all text-sm ${
                  restaurantType === t.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <p className="font-semibold leading-tight">{t.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="form-label">Features (select what they need)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FEATURE_OPTIONS.map((f) => (
              <button
                key={f.key} type="button" onClick={() => toggleFeature(f.key)}
                className={`px-3 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
                  features[f.key]
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {features[f.key] ? '✓ ' : ''}{f.label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={saving} leftIcon={<PlusIcon className="w-5 h-5" />}>
          Create Restaurant Account
        </Button>
      </form>
    </Card>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Inquiries (leads from "Book a Demo" form)
// ═══════════════════════════════════════════════════════════════════════════════
const INQ_BADGE: Record<string, any> = { NEW: 'warning', CONTACTED: 'info', CONVERTED: 'success', REJECTED: 'error' }

const InquiriesTab: React.FC = () => {
  const [inquiries, setInquiries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    try { const r = await api.get('/admin/inquiries'); setInquiries(r.data.data || []) }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [])

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/admin/inquiries/${id}`, { status }); toast.success('Updated'); fetch() }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <Loading text="Loading inquiries…" />

  return (
    <Card padding="none">
      {inquiries.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <EnvelopeIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No inquiries yet</p>
          <p className="text-xs mt-1">Contact form submissions will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {inquiries.map((inq) => (
            <div key={inq.id} className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{inq.name}</p>
                  <Badge variant={INQ_BADGE[inq.status] || 'default'}>{inq.status}</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{inq.email} {inq.phone && `· ${inq.phone}`}</p>
                {inq.restaurant_name && <p className="text-sm text-slate-600 mt-0.5">🏪 {inq.restaurant_name}</p>}
                {inq.message && <p className="text-sm text-slate-500 mt-1 bg-slate-50 rounded-lg p-2">{inq.message}</p>}
                <p className="text-xs text-slate-400 mt-1">{formatRelative(inq.created_at)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {inq.status === 'NEW' && <Button size="xs" variant="secondary" onClick={() => updateStatus(inq.id, 'CONTACTED')}>Mark Contacted</Button>}
                {inq.status === 'CONTACTED' && <Button size="xs" variant="primary" onClick={() => updateStatus(inq.id, 'CONVERTED')}>Converted</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Support Tickets
// ═══════════════════════════════════════════════════════════════════════════════
const TICKET_BADGE: Record<string, any> = { OPEN: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'default' }

const SupportTab: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [replyId, setReplyId] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const fetch = async () => {
    try { const r = await api.get('/admin/support-tickets'); setTickets(r.data.data || []) }
    catch (e) { toast.error(getErrorMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [])

  const sendReply = async (id: string) => {
    if (!reply.trim()) return
    try {
      await api.patch(`/admin/support-tickets/${id}`, { admin_reply: reply, status: 'RESOLVED' })
      toast.success('Reply sent & ticket resolved')
      setReplyId(null); setReply(''); fetch()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <Loading text="Loading tickets…" />

  return (
    <Card padding="none">
      {tickets.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <ChatBubbleLeftRightIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No support tickets</p>
          <p className="text-xs mt-1">Restaurants can raise issues from their Settings panel</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <div key={t.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{t.subject}</p>
                    <Badge variant={TICKET_BADGE[t.status] || 'default'}>{t.status}</Badge>
                    {t.priority === 'URGENT' && <Badge variant="error">URGENT</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t.restaurant_name} · {t.user_name} · {formatRelative(t.created_at)}</p>
                  <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg p-3">{t.message}</p>
                  {t.admin_reply && (
                    <p className="text-sm text-brand-700 mt-2 bg-brand-50 rounded-lg p-3">
                      <span className="font-semibold">Your reply:</span> {t.admin_reply}
                    </p>
                  )}
                </div>
                {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                  <Button size="xs" variant="outline" onClick={() => setReplyId(t.id)}>Reply</Button>
                )}
              </div>
              {replyId === t.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply…" className="form-input flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') sendReply(t.id) }}
                  />
                  <Button size="sm" variant="primary" onClick={() => sendReply(t.id)}>Send & Resolve</Button>
                  <button onClick={() => setReplyId(null)} className="p-2 text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
