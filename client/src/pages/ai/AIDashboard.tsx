import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  CurrencyRupeeIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ClockIcon,
  CubeIcon,
  UserGroupIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BoltIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

import { useAIPolling } from '../../hooks/useAIQuery'
import {
  aiDashboardApi,
  aiForecastApi,
  aiPredictApi,
  aiModelsApi,
  aiInsightsApi,
} from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AILoadingGrid,
} from '../../components/ai/AIShared'
// cn available from '../../lib/utils' if needed

const POLL_INTERVAL = 60_000

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

const formatCompactCurrency = (value: number): string => {
  if (value >= 100_000) {
    return `${(value / 100_000).toFixed(1)}L`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

const truncate = (str: string, length = 60): string =>
  str.length > length ? str.slice(0, length) + '...' : str

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AIDashboard() {
  // ── Data fetching with 60s auto-refresh ──────────────────────
  const dashboard = useAIPolling(
    () => aiDashboardApi.get().then((r) => ({ data: r.data })),
    POLL_INTERVAL,
  )

  const forecast = useAIPolling(
    () => aiForecastApi.revenue(7),
    POLL_INTERVAL,
  )

  const waitTime = useAIPolling(
    () => aiPredictApi.waitTime(),
    POLL_INTERVAL,
  )

  const inventory = useAIPolling(
    () => aiPredictApi.inventory(),
    POLL_INTERVAL,
  )

  const models = useAIPolling(
    () => aiModelsApi.metrics(),
    POLL_INTERVAL,
  )

  const insights = useAIPolling(
    () => aiInsightsApi.daily(),
    POLL_INTERVAL,
  )

  // ── Derived values ───────────────────────────────────────────
  const kpis = dashboard.data?.kpis
  const forecastData = forecast.data?.data ?? forecast.data
  const forecastList: Array<{
    date: string
    predicted_revenue: number
    lower_bound: number
    upper_bound: number
  }> = (forecastData as any)?.forecast ?? []
  const forecastConfidence: number = (forecastData as any)?.confidence ?? 0

  const waitTimeData = waitTime.data?.data ?? waitTime.data
  const inventoryData = inventory.data?.data ?? inventory.data
  const modelsData = models.data?.data ?? models.data
  const insightsData = insights.data?.data ?? insights.data

  const inventoryAtRisk = useMemo(() => {
    if (!Array.isArray(inventoryData)) return 0
    return (inventoryData as Array<{ days_until_stockout: number }>).filter(
      (item) => item.days_until_stockout < 7,
    ).length
  }, [inventoryData])

  const tomorrowForecast = forecastList.length > 0 ? forecastList[0].predicted_revenue : null

  // ── Loading / error states ───────────────────────────────────
  const isLoading = dashboard.loading && !dashboard.data
  const hasError = dashboard.error && !dashboard.data

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader
          title="AI Analytics Dashboard"
          subtitle="Unified intelligence for your restaurant"
        />
        <AIErrorState
          message={dashboard.error ?? 'Failed to load dashboard data'}
          onRetry={dashboard.refetch}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader
          title="AI Analytics Dashboard"
          subtitle="Unified intelligence for your restaurant"
        />
        <AILoadingGrid count={12} />
      </div>
    )
  }

  // ── Chart data ───────────────────────────────────────────────
  const forecastChartData = forecastList.map((f) => ({
    date: new Date(f.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    predicted: f.predicted_revenue,
    lower: f.lower_bound,
    upper: f.upper_bound,
  }))

  const weeklyChartData = (dashboard.data?.weekly_sales?.labels ?? []).map(
    (label: string, i: number) => ({
      week: label,
      revenue: dashboard.data?.weekly_sales?.data?.[i] ?? 0,
    }),
  )

  const hourlyChartData = (dashboard.data?.hourly_sales?.labels ?? []).map(
    (label: string, i: number) => ({
      hour: label,
      orders: dashboard.data?.hourly_sales?.data?.[i] ?? 0,
    }),
  )

  const topItemsChartData = (dashboard.data?.top_items ?? [])
    .slice(0, 8)
    .map((item: any) => ({
      name: item.name ?? item.item_name ?? 'Unknown',
      revenue: item.revenue ?? item.total_revenue ?? 0,
    }))
    .reverse()

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <AIPageHeader
        title="AI Analytics Dashboard"
        subtitle="Unified intelligence for your restaurant"
        actions={
          <div className="flex items-center gap-2">
            {dashboard.data?.generated_at && (
              <span className="text-xs text-slate-400">
                Updated {new Date(dashboard.data.generated_at).toLocaleTimeString('en-IN')}
              </span>
            )}
            <button
              onClick={() => {
                dashboard.refetch()
                forecast.refetch()
                waitTime.refetch()
                inventory.refetch()
                models.refetch()
                insights.refetch()
              }}
              className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
            >
              Refresh All
            </button>
          </div>
        }
      />

      {/* Stat cards - 4 column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Revenue */}
        <AIStatCard
          title="Today's Revenue"
          value={kpis ? formatCurrency(kpis.total_revenue) : '--'}
          icon={CurrencyRupeeIcon}
          trend={kpis?.revenue_growth}
          color="green"
          loading={dashboard.loading && !kpis}
          subtitle="vs previous period"
        />

        {/* 2. Tomorrow Forecast */}
        <AIStatCard
          title="Tomorrow Forecast"
          value={tomorrowForecast !== null ? formatCurrency(tomorrowForecast) : '--'}
          icon={ArrowTrendingUpIcon}
          color="blue"
          loading={forecast.loading && !forecastList.length}
          subtitle={forecastConfidence ? `${(forecastConfidence * 100).toFixed(0)}% confidence` : undefined}
        />

        {/* 3. Growth */}
        <AIStatCard
          title="Revenue Growth"
          value={kpis ? `${kpis.revenue_growth >= 0 ? '+' : ''}${kpis.revenue_growth.toFixed(1)}%` : '--'}
          icon={ChartBarIcon}
          color={kpis && kpis.revenue_growth >= 0 ? 'green' : 'red'}
          loading={dashboard.loading && !kpis}
          subtitle="period over period"
        />

        {/* 4. Prediction Accuracy */}
        <AIStatCard
          title="Prediction Accuracy"
          value={
            (modelsData as any)?.averageAccuracy !== undefined
              ? `${((modelsData as any).averageAccuracy * 100).toFixed(1)}%`
              : '--'
          }
          icon={SparklesIcon}
          color="purple"
          loading={models.loading && !modelsData}
          subtitle="across all models"
        />

        {/* 5. Orders */}
        <AIStatCard
          title="Orders Today"
          value={kpis ? kpis.total_orders.toLocaleString('en-IN') : '--'}
          icon={CubeIcon}
          trend={kpis?.order_growth}
          color="blue"
          loading={dashboard.loading && !kpis}
          subtitle="total orders"
        />

        {/* 6. Inventory Risk */}
        <AIStatCard
          title="Inventory Risk"
          value={Array.isArray(inventoryData) ? `${inventoryAtRisk} items` : '--'}
          icon={ExclamationTriangleIcon}
          color={inventoryAtRisk > 3 ? 'red' : inventoryAtRisk > 0 ? 'amber' : 'green'}
          loading={inventory.loading && !inventoryData}
          subtitle="stockout within 7 days"
        />

        {/* 7. Customer Churn */}
        <AIStatCard
          title="Customer Churn"
          value="Monitoring"
          icon={UserGroupIcon}
          color="indigo"
          loading={false}
          subtitle="churn detection active"
        />

        {/* 8. Average Wait Time */}
        <AIStatCard
          title="Avg Wait Time"
          value={
            (waitTimeData as any)?.estimated_prep_minutes !== undefined
              ? `${(waitTimeData as any).estimated_prep_minutes} min`
              : '--'
          }
          icon={ClockIcon}
          color="amber"
          loading={waitTime.loading && !waitTimeData}
          subtitle={
            (waitTimeData as any)?.kitchen_load
              ? `Kitchen load: ${(waitTimeData as any).kitchen_load}`
              : undefined
          }
        />

        {/* 9. AI Confidence */}
        <AIStatCard
          title="AI Confidence"
          value={forecastConfidence ? `${(forecastConfidence * 100).toFixed(0)}%` : '--'}
          icon={ShieldCheckIcon}
          color={forecastConfidence >= 0.8 ? 'green' : forecastConfidence >= 0.5 ? 'amber' : 'red'}
          loading={forecast.loading && !forecastData}
          subtitle="forecast reliability"
        />

        {/* 10. Model Health */}
        <AIStatCard
          title="Model Health"
          value={
            (modelsData as any)?.totalModels !== undefined
              ? `${(modelsData as any).healthyModels}/${(modelsData as any).totalModels}`
              : '--'
          }
          icon={BoltIcon}
          color={
            (modelsData as any)?.failedModels > 0
              ? 'red'
              : 'green'
          }
          loading={models.loading && !modelsData}
          subtitle={
            (modelsData as any)?.failedModels > 0
              ? `${(modelsData as any).failedModels} failed`
              : 'all healthy'
          }
        />

        {/* 11. Today's Insight */}
        <AIStatCard
          title="Today's Insight"
          value={
            (insightsData as any)?.summary
              ? truncate((insightsData as any).summary, 40)
              : '--'
          }
          icon={LightBulbIcon}
          color="amber"
          loading={insights.loading && !insightsData}
        />

        {/* 12. Recommended Action */}
        <AIStatCard
          title="Recommended Action"
          value={
            Array.isArray((insightsData as any)?.opportunities) &&
            (insightsData as any).opportunities.length > 0
              ? truncate((insightsData as any).opportunities[0].title ?? (insightsData as any).opportunities[0], 40)
              : '--'
          }
          icon={CheckCircleIcon}
          color="green"
          loading={insights.loading && !insightsData}
        />
      </div>

      {/* Charts - 2 column grid on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Forecast with confidence bands */}
        <AIChartCard
          title="Revenue Forecast"
          subtitle={`Next 7 days  |  ${forecastConfidence ? `${(forecastConfidence * 100).toFixed(0)}% confidence` : 'Loading...'}`}
        >
          {forecastChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={forecastChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                  }}
                  formatter={((value: number, name: string) => [
                    formatCurrency(value),
                    name === 'predicted' ? 'Predicted' : name === 'upper' ? 'Upper Bound' : 'Lower Bound',
                  ]) as any}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value: string) =>
                    value === 'predicted' ? 'Predicted Revenue' : value === 'upper' ? 'Upper Bound' : 'Lower Bound'
                  }
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="#93c5fd"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="url(#bandGrad)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="#93c5fd"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="transparent"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#forecastGrad)"
                  dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
              No forecast data available
            </div>
          )}
        </AIChartCard>

        {/* Weekly Revenue */}
        <AIChartCard title="Weekly Revenue" subtitle="Revenue by week">
          {weeklyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                  }}
                  formatter={((value: number) => [formatCurrency(value), 'Revenue']) as any}
                />
                <Bar
                  dataKey="revenue"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
              No weekly data available
            </div>
          )}
        </AIChartCard>

        {/* Hourly Orders */}
        <AIChartCard title="Hourly Orders" subtitle="Order volume by hour">
          {hourlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hourlyChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                  }}
                  formatter={((value: number) => [value, 'Orders']) as any}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
              No hourly data available
            </div>
          )}
        </AIChartCard>

        {/* Top Products - horizontal bar chart */}
        <AIChartCard title="Top Products" subtitle="By revenue">
          {topItemsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topItemsChartData}
                layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={75}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                  }}
                  formatter={((value: number) => [formatCurrency(value), 'Revenue']) as any}
                />
                <Bar
                  dataKey="revenue"
                  fill="#10b981"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
              No product data available
            </div>
          )}
        </AIChartCard>
      </div>

      {/* Anomalies & Opportunities */}
      {insightsData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anomalies */}
          {Array.isArray((insightsData as any)?.anomalies) &&
            (insightsData as any).anomalies.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                  Anomalies Detected
                </h3>
                <ul className="space-y-2">
                  {(insightsData as any).anomalies.map(
                    (anomaly: any, i: number) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-700 bg-amber-50/60 rounded-xl px-3 py-2"
                      >
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <span>
                          {typeof anomaly === 'string'
                            ? anomaly
                            : anomaly.description ?? anomaly.title ?? JSON.stringify(anomaly)}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}

          {/* Opportunities */}
          {Array.isArray((insightsData as any)?.opportunities) &&
            (insightsData as any).opportunities.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <LightBulbIcon className="w-4 h-4 text-emerald-500" />
                  Opportunities
                </h3>
                <ul className="space-y-2">
                  {(insightsData as any).opportunities.map(
                    (opp: any, i: number) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-700 bg-emerald-50/60 rounded-xl px-3 py-2"
                      >
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span>
                          {typeof opp === 'string'
                            ? opp
                            : opp.title ?? opp.description ?? JSON.stringify(opp)}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
