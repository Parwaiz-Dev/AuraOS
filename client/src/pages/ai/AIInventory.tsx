import { useState, useMemo } from 'react'
import {
  CubeIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArchiveBoxIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { aiPredictApi } from '../../services/aiApi'
import { useAIQuery } from '../../hooks/useAIQuery'
import {
  AIPageHeader,
  AIStatCard,
  AIChartCard,
  AIErrorState,
  AIEmptyState,
  AILoadingGrid,
  AIBadge,
  AITabButton,
} from '../../components/ai/AIShared'

interface InventoryItem {
  menu_item_id: string
  name: string
  current_stock: number
  predicted_usage_next_7d: number
  days_until_stockout: number | null
  reorder_recommendation: string
}

type RiskLevel = 'Critical' | 'Warning' | 'Safe' | 'Unknown'

const getRiskLevel = (days: number | null): RiskLevel => {
  if (days === null || days === undefined) return 'Unknown'
  if (days < 3) return 'Critical'
  if (days <= 7) return 'Warning'
  return 'Safe'
}

const riskBadgeVariant: Record<RiskLevel, 'red' | 'yellow' | 'green' | 'gray'> = {
  Critical: 'red',
  Warning: 'yellow',
  Safe: 'green',
  Unknown: 'gray',
}

const riskBarColor: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  Warning: '#f59e0b',
  Safe: '#10b981',
  Unknown: '#94a3b8',
}

type FilterKey = 'All' | RiskLevel

export default function AIInventory() {
  const { data, loading, error, refetch } = useAIQuery<InventoryItem[]>(
    () => aiPredictApi.inventory(),
    [],
  )

  const [filter, setFilter] = useState<FilterKey>('All')

  const enriched = useMemo(() => {
    if (!data) return []
    return data.map((item) => ({
      ...item,
      risk: getRiskLevel(item.days_until_stockout),
    }))
  }, [data])

  const stats = useMemo(() => {
    const total = enriched.length
    const critical = enriched.filter((i) => i.risk === 'Critical').length
    const warning = enriched.filter((i) => i.risk === 'Warning').length
    const safe = enriched.filter((i) => i.risk === 'Safe').length
    return { total, critical, warning, safe }
  }, [enriched])

  const filteredItems = useMemo(() => {
    if (filter === 'All') return enriched
    return enriched.filter((i) => i.risk === filter)
  }, [enriched, filter])

  const criticalChartData = useMemo(() => {
    return enriched
      .filter((i) => i.risk === 'Critical' || i.risk === 'Warning')
      .sort((a, b) => (a.days_until_stockout ?? 99) - (b.days_until_stockout ?? 99))
      .slice(0, 10)
      .map((item) => ({
        name: item.name.length > 15 ? item.name.slice(0, 15) + '...' : item.name,
        days: item.days_until_stockout ?? 0,
        risk: item.risk,
      }))
  }, [enriched])

  const reorderSummary = useMemo(() => {
    return enriched
      .filter(
        (i) =>
          i.reorder_recommendation &&
          i.reorder_recommendation.toLowerCase() !== 'none' &&
          i.reorder_recommendation.toLowerCase() !== 'no action needed',
      )
      .sort((a, b) => (a.days_until_stockout ?? 99) - (b.days_until_stockout ?? 99))
  }, [enriched])

  const filterTabs: FilterKey[] = ['All', 'Critical', 'Warning', 'Safe', 'Unknown']

  if (error) {
    return (
      <div>
        <AIPageHeader
          title="Inventory AI"
          subtitle="Predictive stock management and reorder intelligence"
        />
        <AIErrorState message={error} onRetry={refetch} />
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <AIPageHeader
          title="Inventory AI"
          subtitle="Predictive stock management and reorder intelligence"
        />
        <AILoadingGrid count={4} />
      </div>
    )
  }

  return (
    <div>
      <AIPageHeader
        title="Inventory AI"
        subtitle="Predictive stock management and reorder intelligence"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AIStatCard
          title="Total Items"
          value={stats.total}
          icon={CubeIcon}
          color="blue"
        />
        <AIStatCard
          title="Critical"
          value={stats.critical}
          subtitle="Less than 3 days"
          icon={ExclamationTriangleIcon}
          color="red"
        />
        <AIStatCard
          title="Warning"
          value={stats.warning}
          subtitle="3-7 days remaining"
          icon={ArchiveBoxIcon}
          color="amber"
        />
        <AIStatCard
          title="Safe"
          value={stats.safe}
          subtitle="More than 7 days"
          icon={ShieldCheckIcon}
          color="green"
        />
      </div>

      {enriched.length === 0 ? (
        <AIEmptyState
          icon={CubeIcon}
          title="No Inventory Data"
          description="Inventory predictions are not available yet. Data will appear once the AI model processes your stock information."
        />
      ) : (
        <>
          {criticalChartData.length > 0 && (
            <AIChartCard
              title="Stock Depletion Timeline"
              subtitle="Days until stockout for critical and warning items"
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={criticalChartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    label={{
                      value: 'Days',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: '#94a3b8' },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.75rem',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value} days`, 'Days Until Stockout']}
                  />
                  <Bar dataKey="days" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {criticalChartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={riskBarColor[entry.risk as RiskLevel]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AIChartCard>
          )}

          <div className="card mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <FunnelIcon className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  Filter by Risk Level
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {filterTabs.map((tab) => (
                  <AITabButton
                    key={tab}
                    active={filter === tab}
                    onClick={() => setFilter(tab)}
                  >
                    {tab}
                  </AITabButton>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Predicted 7-Day Usage
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Days Until Stockout
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Risk Level
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Reorder Recommendation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.menu_item_id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                        {item.current_stock}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                        {item.predicted_usage_next_7d}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span
                          className={
                            item.risk === 'Critical'
                              ? 'font-semibold text-red-600'
                              : item.risk === 'Warning'
                                ? 'font-semibold text-amber-600'
                                : 'text-slate-600'
                          }
                        >
                          {item.days_until_stockout !== null
                            ? item.days_until_stockout
                            : '--'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <AIBadge
                          label={item.risk}
                          variant={riskBadgeVariant[item.risk]}
                        />
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                        {item.reorder_recommendation || '--'}
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-sm text-slate-400"
                      >
                        No items match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {reorderSummary.length > 0 && (
            <div className="card mt-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Purchase Recommendations
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Items that require restocking based on AI predictions
              </p>
              <div className="space-y-3">
                {reorderSummary.map((item) => (
                  <div
                    key={item.menu_item_id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50"
                  >
                    <div
                      className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        item.risk === 'Critical'
                          ? 'bg-red-500'
                          : item.risk === 'Warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {item.name}
                        </span>
                        <AIBadge
                          label={item.risk}
                          variant={riskBadgeVariant[item.risk]}
                        />
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {item.reorder_recommendation}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Current stock: {item.current_stock} | Predicted usage:{' '}
                        {item.predicted_usage_next_7d} | Stockout in:{' '}
                        {item.days_until_stockout !== null
                          ? `${item.days_until_stockout} days`
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
