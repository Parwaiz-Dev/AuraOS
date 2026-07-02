import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  StarIcon,
  HeartIcon,
  UserIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  LightBulbIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

import { useAIQuery } from '../../hooks/useAIQuery'
import { aiCustomerApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AILoadingGrid,
  AITabButton,
  AIBadge,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

// ────────────────────────────────────────────────────────────────
// Segment configuration
// ────────────────────────────────────────────────────────────────

type Segment = 'VIP' | 'Loyal' | 'Regular' | 'At Risk' | 'Lost'

const SEGMENT_CONFIG: Record<
  Segment,
  {
    color: string
    chartColor: string
    badgeVariant: 'purple' | 'green' | 'blue' | 'yellow' | 'red'
    icon: React.ElementType
    statColor: 'purple' | 'green' | 'blue' | 'amber' | 'red'
  }
> = {
  VIP: {
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    chartColor: '#8b5cf6',
    badgeVariant: 'purple',
    icon: StarIcon,
    statColor: 'purple',
  },
  Loyal: {
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    chartColor: '#10b981',
    badgeVariant: 'green',
    icon: HeartIcon,
    statColor: 'green',
  },
  Regular: {
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    chartColor: '#3b82f6',
    badgeVariant: 'blue',
    icon: UserIcon,
    statColor: 'blue',
  },
  'At Risk': {
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    chartColor: '#f59e0b',
    badgeVariant: 'yellow',
    icon: ExclamationTriangleIcon,
    statColor: 'amber',
  },
  Lost: {
    color: 'text-red-700 bg-red-50 border-red-200',
    chartColor: '#ef4444',
    badgeVariant: 'red',
    icon: XCircleIcon,
    statColor: 'red',
  },
}

const SEGMENT_ORDER: Segment[] = ['VIP', 'Loyal', 'Regular', 'At Risk', 'Lost']

interface CustomerRecord {
  customerId: string
  name: string
  segment: Segment
  recencyDays: number
  frequency: number
  monetary: number
  totalSpent: number
}

type SortField = 'name' | 'segment' | 'recencyDays' | 'frequency' | 'monetary' | 'totalSpent'
type SortDir = 'asc' | 'desc'

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AICustomerInsights() {
  const [activeSegment, setActiveSegment] = useState<Segment | 'All'>('All')
  const [sortField, setSortField] = useState<SortField>('totalSpent')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Data fetching ─────────────────────────────────────────────
  const { data, loading, error, refetch } = useAIQuery<CustomerRecord[]>(
    () => aiCustomerApi.segments().then((r) => ({ data: r.data?.data ?? r.data })),
    [],
  )

  const customers: CustomerRecord[] = Array.isArray(data) ? data : []

  // ── Segment counts ────────────────────────────────────────────
  const segmentCounts = useMemo(() => {
    const counts: Record<Segment, number> = {
      VIP: 0,
      Loyal: 0,
      Regular: 0,
      'At Risk': 0,
      Lost: 0,
    }
    customers.forEach((c) => {
      if (counts[c.segment] !== undefined) {
        counts[c.segment]++
      }
    })
    return counts
  }, [customers])

  // ── Pie chart data ────────────────────────────────────────────
  const pieData = useMemo(
    () =>
      SEGMENT_ORDER.map((seg) => ({
        name: seg,
        value: segmentCounts[seg],
        color: SEGMENT_CONFIG[seg].chartColor,
      })).filter((d) => d.value > 0),
    [segmentCounts],
  )

  // ── Growth / summary stats ────────────────────────────────────
  const summaryStats = useMemo(() => {
    if (customers.length === 0) return null

    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0)
    const avgLifetimeValue = totalRevenue / customers.length
    const vipRevenue = customers
      .filter((c) => c.segment === 'VIP')
      .reduce((sum, c) => sum + c.totalSpent, 0)
    const loyalRevenue = customers
      .filter((c) => c.segment === 'Loyal')
      .reduce((sum, c) => sum + c.totalSpent, 0)
    const healthyPct =
      customers.length > 0
        ? ((segmentCounts.VIP + segmentCounts.Loyal + segmentCounts.Regular) / customers.length) * 100
        : 0
    const atRiskPct =
      customers.length > 0
        ? ((segmentCounts['At Risk'] + segmentCounts.Lost) / customers.length) * 100
        : 0

    return {
      totalRevenue,
      avgLifetimeValue,
      vipRevenue,
      loyalRevenue,
      healthyPct,
      atRiskPct,
      totalCustomers: customers.length,
    }
  }, [customers, segmentCounts])

  // ── Filtered & sorted customers ───────────────────────────────
  const filteredCustomers = useMemo(() => {
    let list = activeSegment === 'All' ? customers : customers.filter((c) => c.segment === activeSegment)

    list = [...list].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const numA = typeof aVal === 'number' ? aVal : 0
      const numB = typeof bVal === 'number' ? bVal : 0
      return sortDir === 'asc' ? numA - numB : numB - numA
    })

    return list
  }, [customers, activeSegment, sortField, sortDir])

  // ── Sort handler ──────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? (
      <ChevronUpIcon className="w-3.5 h-3.5 inline ml-0.5" />
    ) : (
      <ChevronDownIcon className="w-3.5 h-3.5 inline ml-0.5" />
    )
  }

  // ── Loading / error states ────────────────────────────────────
  const isLoading = loading && !data
  const hasError = error && !data

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader
          title="Customer Insights"
          subtitle="AI-powered customer segmentation and analysis"
        />
        <AIErrorState message={error ?? 'Failed to load customer data'} onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader
          title="Customer Insights"
          subtitle="AI-powered customer segmentation and analysis"
        />
        <AILoadingGrid count={5} />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <AIPageHeader
        title="Customer Insights"
        subtitle="AI-powered customer segmentation and analysis"
        actions={
          <button
            onClick={refetch}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            Refresh
          </button>
        }
      />

      {/* Segment summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {SEGMENT_ORDER.map((seg) => {
          const config = SEGMENT_CONFIG[seg]
          return (
            <AIStatCard
              key={seg}
              title={seg}
              value={segmentCounts[seg].toLocaleString('en-IN')}
              icon={config.icon}
              color={config.statColor}
              loading={loading && customers.length === 0}
              subtitle={
                customers.length > 0
                  ? `${((segmentCounts[seg] / customers.length) * 100).toFixed(1)}% of total`
                  : undefined
              }
            />
          )
        })}
      </div>

      {/* Chart + Growth trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <AIChartCard
          title="Segment Distribution"
          subtitle={`${customers.length.toLocaleString('en-IN')} total customers`}
        >
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: any) => [
                    `${value.toLocaleString('en-IN')} customers`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) => (
                    <span className="text-slate-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-sm text-slate-400">
              No segment data available
            </div>
          )}
        </AIChartCard>

        {/* Growth trend / health overview */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-blue-500" />
              Customer Health Overview
            </h3>
            {summaryStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Customers</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {summaryStats.totalCustomers.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Lifetime Revenue</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(summaryStats.totalRevenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Avg Customer Lifetime Value</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(summaryStats.avgLifetimeValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">VIP Revenue Contribution</span>
                  <span className="text-sm font-semibold text-purple-700">
                    {formatCurrency(summaryStats.vipRevenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Loyal Revenue Contribution</span>
                  <span className="text-sm font-semibold text-emerald-700">
                    {formatCurrency(summaryStats.loyalRevenue)}
                  </span>
                </div>

                {/* Health bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Customer Health</span>
                    <span className="text-xs font-medium text-emerald-600">
                      {summaryStats.healthyPct.toFixed(1)}% healthy
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-purple-500 h-full"
                      style={{
                        width: `${customers.length > 0 ? (segmentCounts.VIP / customers.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${customers.length > 0 ? (segmentCounts.Loyal / customers.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${customers.length > 0 ? (segmentCounts.Regular / customers.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${customers.length > 0 ? (segmentCounts['At Risk'] / customers.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-red-500 h-full"
                      style={{
                        width: `${customers.length > 0 ? (segmentCounts.Lost / customers.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {SEGMENT_ORDER.map((seg) => (
                      <div key={seg} className="flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: SEGMENT_CONFIG[seg].chartColor }}
                        />
                        <span className="text-[10px] text-slate-500">{seg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-8">
                No customer data available
              </div>
            )}
          </div>

          {/* At Risk percentage card */}
          {summaryStats && summaryStats.atRiskPct > 0 && (
            <div className="card border-amber-200 bg-amber-50/30">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">
                    {summaryStats.atRiskPct.toFixed(1)}% of customers need attention
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {segmentCounts['At Risk'] + segmentCounts.Lost} customers are at risk or lost.
                    See retention suggestions below.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Retention suggestions */}
      {(segmentCounts['At Risk'] > 0 || segmentCounts.Lost > 0) && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <LightBulbIcon className="w-4 h-4 text-amber-500" />
            Retention Suggestions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {segmentCounts['At Risk'] > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <h4 className="text-sm font-semibold text-amber-800 mb-2">
                  At Risk Customers ({segmentCounts['At Risk']})
                </h4>
                <ul className="space-y-2 text-sm text-amber-900">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    Send personalised re-engagement emails with exclusive offers or discounts on their favourite items.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    Create a limited-time loyalty bonus (e.g., double points) to incentivise their next order.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    Reach out with a feedback survey to understand what might have caused decreased visits.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    Offer a complimentary item or free delivery on their next order to rebuild the relationship.
                  </li>
                </ul>
              </div>
            )}
            {segmentCounts.Lost > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                <h4 className="text-sm font-semibold text-red-800 mb-2">
                  Lost Customers ({segmentCounts.Lost})
                </h4>
                <ul className="space-y-2 text-sm text-red-900">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    Launch a "We miss you" win-back campaign with a significant discount (20-30% off).
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    Highlight new menu items or improvements they may have missed since their last visit.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    Consider a direct SMS or WhatsApp outreach with a personal touch from the restaurant.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    Analyse ordering history to tailor a comeback offer based on their past preferences.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Segment filter buttons */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <AITabButton active={activeSegment === 'All'} onClick={() => setActiveSegment('All')}>
          All ({customers.length})
        </AITabButton>
        {SEGMENT_ORDER.map((seg) => (
          <AITabButton
            key={seg}
            active={activeSegment === seg}
            onClick={() => setActiveSegment(seg)}
          >
            {seg} ({segmentCounts[seg]})
          </AITabButton>
        ))}
      </div>

      {/* Customer detail table */}
      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Customer Details
          <span className="ml-2 text-xs font-normal text-slate-400">
            {filteredCustomers.length.toLocaleString('en-IN')} customers
          </span>
        </h3>
        {filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th
                    className="text-left font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('name')}
                  >
                    Customer <SortIcon field="name" />
                  </th>
                  <th
                    className="text-left font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('segment')}
                  >
                    Segment <SortIcon field="segment" />
                  </th>
                  <th
                    className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('recencyDays')}
                  >
                    Recency (Days) <SortIcon field="recencyDays" />
                  </th>
                  <th
                    className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('frequency')}
                  >
                    Frequency <SortIcon field="frequency" />
                  </th>
                  <th
                    className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('monetary')}
                  >
                    Monetary <SortIcon field="monetary" />
                  </th>
                  <th
                    className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('totalSpent')}
                  >
                    Lifetime Value <SortIcon field="totalSpent" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCustomers.map((c, i) => {
                  const config = SEGMENT_CONFIG[c.segment] ?? SEGMENT_CONFIG.Regular
                  return (
                    <tr
                      key={c.customerId}
                      className={cn(
                        'hover:bg-slate-50/50 transition-colors',
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-25',
                      )}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                            {c.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <span className="font-medium text-slate-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <AIBadge label={c.segment} variant={config.badgeVariant} />
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {c.recencyDays.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {c.frequency.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {formatCurrency(c.monetary)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(c.totalSpent)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            No customers found in this segment
          </div>
        )}
      </div>
    </div>
  )
}
