import { useState, useMemo, useCallback } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  CurrencyRupeeIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

import { useAIQuery } from '../../hooks/useAIQuery'
import { aiForecastApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AILoadingGrid,
  AITabButton,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

const formatCompactCurrency = (value: number): string => {
  if (value >= 100_000) return `${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

type ForecastMode = 'revenue' | 'orders'
type ForecastDays = 7 | 30 | 90

interface ForecastItem {
  date: string
  predicted_revenue?: number
  predicted_orders?: number
  lower_bound: number
  upper_bound: number
}

interface ForecastResponse {
  data: {
    forecast: ForecastItem[]
    confidence: number
    model_version: string
    generated_at: string
  }
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AIForecasts() {
  const [days, setDays] = useState<ForecastDays>(30)
  const [mode, setMode] = useState<ForecastMode>('revenue')

  // ── Data fetching ─────────────────────────────────────────────
  const revenue = useAIQuery<ForecastResponse['data']>(
    () => aiForecastApi.revenue(days).then((r) => ({ data: r.data?.data ?? r.data })),
    [days],
  )

  const orders = useAIQuery<ForecastResponse['data']>(
    () => aiForecastApi.orders(days).then((r) => ({ data: r.data?.data ?? r.data })),
    [days],
  )

  const active = mode === 'revenue' ? revenue : orders
  const forecastList: ForecastItem[] = (active.data as any)?.forecast ?? []
  const confidence: number = (active.data as any)?.confidence ?? 0
  const modelVersion: string = (active.data as any)?.model_version ?? '--'
  const generatedAt: string = (active.data as any)?.generated_at ?? ''

  // ── Derived stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    if (forecastList.length === 0) return null

    const values = forecastList.map((f) =>
      mode === 'revenue' ? (f.predicted_revenue ?? 0) : (f.predicted_orders ?? 0),
    )
    const total = values.reduce((sum, v) => sum + v, 0)
    const avg = total / values.length
    const peakValue = Math.max(...values)
    const peakIndex = values.indexOf(peakValue)
    const peakDate = forecastList[peakIndex]?.date ?? '--'

    return { total, avg, peakValue, peakDate }
  }, [forecastList, mode])

  // ── Chart data ────────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      forecastList.map((f) => ({
        date: new Date(f.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        predicted: mode === 'revenue' ? (f.predicted_revenue ?? 0) : (f.predicted_orders ?? 0),
        lower: f.lower_bound,
        upper: f.upper_bound,
      })),
    [forecastList, mode],
  )

  // ── CSV download ──────────────────────────────────────────────
  const downloadCSV = useCallback(
    (extension: '.csv' | '.csv') => {
      if (forecastList.length === 0) return
      const label = mode === 'revenue' ? 'Predicted Revenue' : 'Predicted Orders'
      const header = `Date,${label},Lower Bound,Upper Bound\n`
      const rows = forecastList
        .map((f) => {
          const value = mode === 'revenue' ? (f.predicted_revenue ?? 0) : (f.predicted_orders ?? 0)
          return `${f.date},${value},${f.lower_bound},${f.upper_bound}`
        })
        .join('\n')
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${mode}_forecast_${days}d${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },
    [forecastList, mode, days],
  )

  // ── Loading / error states ────────────────────────────────────
  const isLoading = active.loading && !active.data
  const hasError = active.error && !active.data

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader
          title="Revenue & Order Forecast"
          subtitle="AI-powered predictions for your restaurant"
        />
        <AIErrorState
          message={active.error ?? 'Failed to load forecast data'}
          onRetry={active.refetch}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader
          title="Revenue & Order Forecast"
          subtitle="AI-powered predictions for your restaurant"
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
        title="Revenue & Order Forecast"
        subtitle="AI-powered predictions for your restaurant"
        actions={
          <div className="flex items-center gap-2">
            {generatedAt && (
              <span className="text-xs text-slate-400">
                Generated {new Date(generatedAt).toLocaleString('en-IN')}
              </span>
            )}
            <button
              onClick={() => {
                revenue.refetch()
                orders.refetch()
              }}
              className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Forecast period tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {([7, 30, 90] as ForecastDays[]).map((d) => (
            <AITabButton key={d} active={days === d} onClick={() => setDays(d)}>
              {d} Days
            </AITabButton>
          ))}
        </div>

        {/* Revenue / Orders toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <AITabButton active={mode === 'revenue'} onClick={() => setMode('revenue')}>
            Revenue
          </AITabButton>
          <AITabButton active={mode === 'orders'} onClick={() => setMode('orders')}>
            Orders
          </AITabButton>
        </div>

        {/* Download buttons */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => downloadCSV('.csv')}
            disabled={forecastList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            Download CSV
          </button>
          <button
            onClick={() => downloadCSV('.csv')}
            disabled={forecastList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            Download Excel
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AIStatCard
          title={mode === 'revenue' ? 'Total Forecasted Revenue' : 'Total Forecasted Orders'}
          value={
            stats
              ? mode === 'revenue'
                ? formatCurrency(stats.total)
                : stats.total.toLocaleString('en-IN')
              : '--'
          }
          icon={mode === 'revenue' ? CurrencyRupeeIcon : ClipboardDocumentListIcon}
          color="blue"
          loading={active.loading && !stats}
          subtitle={`Next ${days} days`}
        />
        <AIStatCard
          title={mode === 'revenue' ? 'Avg Daily Revenue' : 'Avg Daily Orders'}
          value={
            stats
              ? mode === 'revenue'
                ? formatCurrency(stats.avg)
                : Math.round(stats.avg).toLocaleString('en-IN')
              : '--'
          }
          icon={ChartBarIcon}
          color="green"
          loading={active.loading && !stats}
          subtitle="Average per day"
        />
        <AIStatCard
          title="Peak Day"
          value={
            stats
              ? new Date(stats.peakDate).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short',
                })
              : '--'
          }
          icon={ArrowTrendingUpIcon}
          color="amber"
          loading={active.loading && !stats}
          subtitle={
            stats
              ? mode === 'revenue'
                ? formatCurrency(stats.peakValue)
                : `${stats.peakValue.toLocaleString('en-IN')} orders`
              : undefined
          }
        />
        <AIStatCard
          title="Confidence"
          value={confidence ? `${(confidence * 100).toFixed(1)}%` : '--'}
          icon={ShieldCheckIcon}
          color={confidence >= 0.8 ? 'green' : confidence >= 0.5 ? 'amber' : 'red'}
          loading={active.loading && !active.data}
          subtitle="Forecast reliability"
        />
        <AIStatCard
          title="Model Version"
          value={modelVersion}
          icon={CpuChipIcon}
          color="purple"
          loading={active.loading && !active.data}
          subtitle="Active model"
        />
      </div>

      {/* Forecast chart */}
      <AIChartCard
        title={mode === 'revenue' ? 'Revenue Forecast' : 'Order Forecast'}
        subtitle={`${days}-day prediction  |  ${confidence ? `${(confidence * 100).toFixed(0)}% confidence` : 'Loading...'}`}
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="fcPredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fcBandGrad" x1="0" y1="0" x2="0" y2="1">
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
                interval={days >= 90 ? 6 : days >= 30 ? 2 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  mode === 'revenue' ? formatCompactCurrency(v) : v.toLocaleString('en-IN')
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  mode === 'revenue' ? formatCurrency(value) : value.toLocaleString('en-IN'),
                  name === 'predicted'
                    ? mode === 'revenue'
                      ? 'Predicted Revenue'
                      : 'Predicted Orders'
                    : name === 'upper'
                      ? 'Upper Bound'
                      : 'Lower Bound',
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) =>
                  value === 'predicted'
                    ? mode === 'revenue'
                      ? 'Predicted Revenue'
                      : 'Predicted Orders'
                    : value === 'upper'
                      ? 'Upper Bound'
                      : 'Lower Bound'
                }
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="#93c5fd"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="url(#fcBandGrad)"
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
                fill="url(#fcPredGrad)"
                dot={days <= 30 ? { r: 3, fill: '#3b82f6', strokeWidth: 0 } : false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[360px] text-sm text-slate-400">
            No forecast data available
          </div>
        )}
      </AIChartCard>

      {/* Forecast explanation */}
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-50">
            <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">How this forecast works</h3>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Our AI model analyses historical sales patterns, seasonal trends, day-of-week effects,
              and external factors to predict future {mode === 'revenue' ? 'revenue' : 'order volume'}.
              The shaded band represents the confidence interval between upper and lower bounds.
              A higher confidence score indicates the model is more certain about its predictions.
              Forecasts are regenerated daily as new data becomes available, and model accuracy
              improves over time as it learns from your restaurant's unique patterns.
            </p>
          </div>
        </div>
      </div>

      {/* Forecast data table */}
      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Forecast Data</h3>
        {forecastList.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider">
                    {mode === 'revenue' ? 'Predicted Revenue' : 'Predicted Orders'}
                  </th>
                  <th className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider">
                    Lower Bound
                  </th>
                  <th className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider">
                    Upper Bound
                  </th>
                  <th className="text-right font-medium text-slate-500 px-6 py-3 text-xs uppercase tracking-wider">
                    Range
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {forecastList.map((f, i) => {
                  const predicted =
                    mode === 'revenue' ? (f.predicted_revenue ?? 0) : (f.predicted_orders ?? 0)
                  const range = f.upper_bound - f.lower_bound
                  return (
                    <tr
                      key={f.date}
                      className={cn(
                        'hover:bg-slate-50/50 transition-colors',
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-25',
                      )}
                    >
                      <td className="px-6 py-3 text-slate-900 font-medium">
                        {new Date(f.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-900 font-semibold">
                        {mode === 'revenue'
                          ? formatCurrency(predicted)
                          : predicted.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500">
                        {mode === 'revenue'
                          ? formatCurrency(f.lower_bound)
                          : f.lower_bound.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500">
                        {mode === 'revenue'
                          ? formatCurrency(f.upper_bound)
                          : f.upper_bound.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-xs text-slate-400">
                          {mode === 'revenue'
                            ? formatCurrency(range)
                            : range.toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            No forecast data available
          </div>
        )}
      </div>
    </div>
  )
}
