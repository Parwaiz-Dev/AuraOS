import { useEffect, useState, useCallback, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import api, { getErrorMessage } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useFeatures } from '../contexts/FeaturesContext'
import { formatCurrency } from '../lib/utils'
import {
  DASHBOARD_CARDS_BY_TYPE,
  DASHBOARD_CARD_CONFIG,
  SETUP_WIZARD_STEPS,
  loadSetupProgress,
  computeSetupProgress,
} from '../config/restaurantTypes'
import type { DashboardCardKey } from '../config/restaurantTypes'
import Card from '../components/Card'
import Loading from '../components/Loading'
import SetupWizard from '../components/SetupWizard'
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

interface DashboardData {
  total_orders_today: number
  active_orders: number
  completed_orders_today: number
  cancelled_orders_today: number
  revenue_today: number
  occupied_tables: number
  low_stock_items: number
}

interface RevenuePoint { date: string; revenue: number }
interface TopItem { name: string; total_quantity: number; total_revenue: number }

const StatCard = ({
  label, value, icon: Icon, color, sub,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  sub?: string
}) => (
  <Card hover className="flex items-center gap-4">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-md ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </Card>
)

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-900 text-white px-3 py-2 rounded-xl text-sm shadow-xl border border-white/10">
      <p className="text-navy-300 text-xs mb-1">{label}</p>
      <p className="font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { restaurantType } = useFeatures()

  // Super-admins go straight to their platform panel
  if (user?.isSuperAdmin) return <Navigate to="/owner" replace />

  // Determine dashboard cards by restaurant type (default: FULL_SERVICE)
  const cardKeys: DashboardCardKey[] =
    DASHBOARD_CARDS_BY_TYPE[restaurantType || 'FULL_SERVICE']

  // ── Setup Wizard state ──
  const [showWizard, setShowWizard] = useState(false)
  const [wizardDismissed, setWizardDismissed] = useState(false)
  const setupSteps = SETUP_WIZARD_STEPS[restaurantType || 'FULL_SERVICE']
  const setupProgress = useMemo(() => {
    if (!user?.restaurantId) return 100
    const p = loadSetupProgress(user.restaurantId)
    return computeSetupProgress(p, setupSteps.length)
  }, [user?.restaurantId, setupSteps.length])
  const showSetupPrompt = !wizardDismissed && setupProgress < 100

  const [data, setData] = useState<DashboardData | null>(null)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { on, off } = useSocket()

  const fetchAll = useCallback(async () => {
    try {
      setError('')
      const [dashRes, revRes, topRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/daily-revenue', { params: { days: 7 } }),
        api.get('/reports/top-items', { params: { limit: 5 } }),
      ])
      setData(dashRes.data.data)
      setRevenue(revRes.data.data || [])
      setTopItems(topRes.data.data || [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    on('ORDER_CREATED', fetchAll)
    on('ORDER_UPDATED', fetchAll)
    on('ORDER_COMPLETED', fetchAll)
    on('PAYMENT_COMPLETED', fetchAll)
    return () => {
      off('ORDER_CREATED')
      off('ORDER_UPDATED')
      off('ORDER_COMPLETED')
      off('PAYMENT_COMPLETED')
    }
  }, [on, off, fetchAll])

  if (loading) return <Loading text="Loading dashboard…" />

  const avgOrderValue =
    data && data.completed_orders_today > 0
      ? data.revenue_today / data.completed_orders_today
      : 0

  // Resolve value + optional subtext for a card key
  const resolveCard = (key: DashboardCardKey): { value: string | number; sub?: string } => {
    switch (key) {
      case 'revenue_today':
        return {
          value: formatCurrency(data?.revenue_today || 0),
          sub: `Avg ${formatCurrency(avgOrderValue)} / order`,
        }
      case 'total_orders_today':
        return {
          value: data?.total_orders_today || 0,
          sub: `${data?.completed_orders_today || 0} completed`,
        }
      case 'active_orders':
        return { value: data?.active_orders || 0, sub: 'In kitchen right now' }
      case 'occupied_tables':
        return { value: data?.occupied_tables || 0, sub: 'Currently serving' }
      case 'completed_orders_today':
        return { value: data?.completed_orders_today || 0, sub: 'Completed today' }
      case 'cancelled_orders_today':
        return { value: data?.cancelled_orders_today || 0 }
      case 'low_stock_items':
        return { value: data?.low_stock_items || 0 }
      default:
        return { value: 0 }
    }
  }

  const COLORS = ['#2456eb', '#3b71f6', '#f59e0b', '#fbbf24', '#93bbfd']

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero header */}
      <div className="surface-brand rounded-3xl p-6 lg:p-7 relative overflow-hidden shadow-lg">
        {/* decorative glow */}
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
              {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-brand-100 mt-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {data?.low_stock_items ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm ring-1 ring-white/20">
              <ExclamationTriangleIcon className="w-4 h-4 text-accent-300" />
              {data.low_stock_items} low stock alert{data.low_stock_items > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Setup Wizard — shown when user clicks "Complete Setup" card */}
      {showWizard && restaurantType && user?.restaurantId && (
        <div className="animate-fade-in">
          <SetupWizard
            restaurantId={user.restaurantId}
            restaurantType={restaurantType}
            onComplete={() => {
              setShowWizard(false)
              setWizardDismissed(false)
              fetchAll()
            }}
            onDismiss={() => setShowWizard(false)}
          />
        </div>
      )}

      {/* Stat cards — dynamic by restaurant type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Complete Setup card — shown when setup is incomplete */}
        {showSetupPrompt && (
          <Card
            hover
            className="flex items-center gap-4 cursor-pointer border-2 border-dashed border-brand-300 bg-brand-50/50"
            onClick={() => setShowWizard(true)}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-md bg-gradient-to-br from-brand-500 to-brand-700">
              <Cog6ToothIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500 font-medium">Setup Progress</p>
              <p className="text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                {setupProgress}%
              </p>
              <p className="text-xs text-brand-600 mt-0.5 font-medium">
                Complete your restaurant setup →
              </p>
            </div>
          </Card>
        )}

        {cardKeys.map((key) => {
          const cfg = DASHBOARD_CARD_CONFIG[key]
          const resolved = resolveCard(key)
          return (
            <StatCard
              key={key}
              label={cfg.label}
              value={resolved.value}
              icon={cfg.icon}
              color={cfg.color}
              sub={resolved.sub}
            />
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-gray-900">Revenue Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
            </div>
            <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-500" />
          </div>
          {revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenue} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2456eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2456eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2456eb"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#2456eb' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              No revenue data yet
            </div>
          )}
        </Card>

        {/* Top items */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-gray-900">Top Items</h2>
              <p className="text-xs text-gray-400 mt-0.5">By quantity sold</p>
            </div>
          </div>
          {topItems.length > 0 ? (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: COLORS[i] || '#6366f1' }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.total_quantity} sold</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {formatCurrency(item.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No sales data yet
            </div>
          )}
        </Card>
      </div>

      {/* Order status summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <CheckCircleIcon className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{data?.completed_orders_today || 0}</p>
            <p className="text-sm text-gray-500">Completed today</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <ClockIcon className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{data?.active_orders || 0}</p>
            <p className="text-sm text-gray-500">In progress</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{data?.cancelled_orders_today || 0}</p>
            <p className="text-sm text-gray-500">Cancelled today</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
