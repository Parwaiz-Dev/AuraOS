import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import api, { getErrorMessage } from '../api'
import { formatCurrency } from '../lib/utils'
import Card from '../components/Card'
import Loading from '../components/Loading'
import Badge from '../components/Badge'
import {
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface DashboardData {
  total_orders_today: number
  completed_orders_today: number
  cancelled_orders_today: number
  active_orders: number
  revenue_today: number
  low_stock_items: number
}

interface TopItem { name: string; total_quantity: number; total_revenue: number }
interface RevenuePoint { date: string; revenue: number }
interface InventoryAlert {
  inventory_item_id: string
  menu_item_name: string
  current_stock: number
  reorder_level: number
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

const Reports: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [revenueDays, setRevenueDays] = useState(7)

  const fetchAll = async (days = revenueDays) => {
    try {
      const [dashRes, topRes, revRes, alertRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/top-items', { params: { limit: 10 } }),
        api.get('/reports/daily-revenue', { params: { days } }),
        api.get('/reports/inventory-alerts'),
      ])
      setDashboard(dashRes.data.data)
      setTopItems(topRes.data.data || [])
      setRevenue(revRes.data.data || [])
      setAlerts(alertRes.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleDaysChange = (days: number) => {
    setRevenueDays(days)
    fetchAll(days)
  }

  if (loading) return <Loading text="Loading reports…" />

  const avgOrderValue =
    dashboard && dashboard.completed_orders_today > 0
      ? dashboard.revenue_today / dashboard.completed_orders_today
      : 0

  const pieData = topItems.slice(0, 5).map((item) => ({
    name: item.name,
    value: item.total_quantity,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Today's performance overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Today's Revenue",
            value: formatCurrency(dashboard?.revenue_today || 0),
            icon: CurrencyDollarIcon,
            color: 'bg-emerald-100 text-emerald-600',
          },
          {
            label: 'Total Orders',
            value: dashboard?.total_orders_today || 0,
            icon: ClipboardDocumentListIcon,
            color: 'bg-indigo-100 text-indigo-600',
          },
          {
            label: 'Avg Order Value',
            value: formatCurrency(avgOrderValue),
            icon: CurrencyDollarIcon,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Completed',
            value: dashboard?.completed_orders_today || 0,
            icon: CheckCircleIcon,
            color: 'bg-purple-100 text-purple-600',
          },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-semibold text-gray-900">Revenue Trend</h2>
            <p className="text-xs text-gray-400 mt-0.5">Daily revenue breakdown</p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  revenueDays === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={revenue} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
              }
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#6366f1' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Top items + Pie */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bar chart */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-6">Top Selling Items</h2>
          {topItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topItems.slice(0, 8)}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  formatter={(v: any) => [`${v} sold`, 'Quantity']}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                />
                <Bar dataKey="total_quantity" radius={[0, 4, 4, 0]}>
                  {topItems.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              No sales data yet
            </div>
          )}
        </Card>

        {/* Pie chart */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-6">Sales Distribution</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => [`${v} sold`, '']}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
        </Card>
      </div>

      {/* Inventory alerts */}
      {alerts.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Inventory Alerts</h2>
            <Badge variant="warning">{alerts.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.inventory_item_id}>
                    <td className="font-medium">{a.menu_item_name}</td>
                    <td className="font-semibold text-red-600">{a.current_stock}</td>
                    <td className="text-gray-500">{a.reorder_level}</td>
                    <td>
                      <Badge variant={a.current_stock === 0 ? 'error' : 'warning'}>
                        {a.current_stock === 0 ? 'Out of Stock' : 'Low Stock'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default Reports
