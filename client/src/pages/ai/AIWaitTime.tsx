import { useMemo } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ClockIcon,
  BoltIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

import { useAIPolling } from '../../hooks/useAIQuery'
import { aiPredictApi, aiRevenueApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AILoadingGrid,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

const POLL_INTERVAL = 30_000

function getLoadColor(load: number): 'green' | 'amber' | 'red' {
  if (load < 50) return 'green'
  if (load <= 80) return 'amber'
  return 'red'
}

function getLoadBarColor(load: number): string {
  if (load < 50) return 'bg-emerald-500'
  if (load <= 80) return 'bg-amber-500'
  return 'bg-red-500'
}

function getLoadBgColor(load: number): string {
  if (load < 50) return 'bg-emerald-100'
  if (load <= 80) return 'bg-amber-100'
  return 'bg-red-100'
}

function getStaffRecommendation(load: number): {
  message: string
  severity: 'green' | 'blue' | 'amber' | 'red'
  icon: React.ElementType
} {
  if (load < 30) {
    return {
      message: 'Kitchen is running light. Consider reducing staff.',
      severity: 'blue',
      icon: UserGroupIcon,
    }
  }
  if (load <= 60) {
    return {
      message: 'Optimal staffing level. Kitchen is performing well.',
      severity: 'green',
      icon: CheckCircleIcon,
    }
  }
  if (load <= 80) {
    return {
      message: 'Kitchen is getting busy. Consider adding support.',
      severity: 'amber',
      icon: ExclamationTriangleIcon,
    }
  }
  return {
    message: 'Kitchen is overloaded! Additional staff needed immediately.',
    severity: 'red',
    icon: ExclamationTriangleIcon,
  }
}

const severityStyles = {
  green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  red: 'bg-red-50 border-red-200 text-red-800',
}

const severityIconStyles = {
  green: 'text-emerald-600',
  blue: 'text-blue-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
}

export default function AIWaitTime() {
  const waitTime = useAIPolling(
    () => aiPredictApi.waitTime(),
    POLL_INTERVAL,
  )

  const peakHours = useAIPolling(
    () => aiRevenueApi.peakHours(),
    POLL_INTERVAL,
  )

  const wt = waitTime.data?.data ?? waitTime.data
  const peakData = peakHours.data?.data ?? peakHours.data

  const kitchenLoad = useMemo(() => {
    if (!wt) return 0
    const raw = (wt as any)?.kitchen_load
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') return parseFloat(raw) || 0
    return 0
  }, [wt])

  const kitchenLoadPct = useMemo(() => {
    return kitchenLoad > 1 ? kitchenLoad : kitchenLoad * 100
  }, [kitchenLoad])

  const confidence = useMemo(() => {
    const raw = (wt as any)?.confidence
    if (typeof raw !== 'number') return 0
    return raw > 1 ? raw : raw * 100
  }, [wt])

  const peakChartData = useMemo(() => {
    if (!Array.isArray(peakData)) return []
    return (peakData as Array<{ hour: number; order_count: number }>).map((h) => ({
      hour: `${h.hour.toString().padStart(2, '0')}:00`,
      orders: h.order_count,
    }))
  }, [peakData])

  const recommendation = useMemo(() => getStaffRecommendation(kitchenLoadPct), [kitchenLoadPct])

  const isLoading = waitTime.loading && !waitTime.data
  const hasError = waitTime.error && !waitTime.data

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader title="Wait Time AI" subtitle="Real-time kitchen and delivery predictions" />
        <AIErrorState
          message={waitTime.error ?? 'Failed to load wait time data'}
          onRetry={waitTime.refetch}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader title="Wait Time AI" subtitle="Real-time kitchen and delivery predictions" />
        <AILoadingGrid count={4} />
      </div>
    )
  }

  const prepMinutes = (wt as any)?.estimated_prep_minutes ?? '--'
  const deliveryMinutes = (wt as any)?.estimated_delivery_minutes ?? '--'

  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Wait Time AI"
        subtitle="Real-time kitchen and delivery predictions"
        actions={
          <button
            onClick={() => {
              waitTime.refetch()
              peakHours.refetch()
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* Prominent current wait time */}
      <div className="card flex flex-col items-center justify-center py-10">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Current Estimated Wait
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-extrabold text-slate-900">
            {typeof prepMinutes === 'number' ? prepMinutes : '--'}
          </span>
          <span className="text-xl font-medium text-slate-400">minutes</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Delivery: {typeof deliveryMinutes === 'number' ? `${deliveryMinutes} min` : '--'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AIStatCard
          title="Current Wait"
          value={typeof prepMinutes === 'number' ? `${prepMinutes} min` : '--'}
          icon={ClockIcon}
          color="blue"
          loading={waitTime.loading && !wt}
          subtitle="estimated prep time"
        />
        <AIStatCard
          title="Predicted Wait"
          value={typeof deliveryMinutes === 'number' ? `${deliveryMinutes} min` : '--'}
          icon={ClockIcon}
          color="purple"
          loading={waitTime.loading && !wt}
          subtitle="estimated delivery"
        />
        <AIStatCard
          title="Kitchen Load"
          value={wt ? `${kitchenLoadPct.toFixed(0)}%` : '--'}
          icon={BoltIcon}
          color={getLoadColor(kitchenLoadPct)}
          loading={waitTime.loading && !wt}
          subtitle="current utilization"
        />
        <AIStatCard
          title="Confidence"
          value={wt ? `${confidence.toFixed(0)}%` : '--'}
          icon={ShieldCheckIcon}
          color={confidence >= 80 ? 'green' : confidence >= 50 ? 'amber' : 'red'}
          loading={waitTime.loading && !wt}
          subtitle="prediction accuracy"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kitchen load gauge */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Kitchen Load</h3>
          <p className="text-xs text-slate-500 mb-4">Current kitchen utilization</p>
          <div className="space-y-3">
            <div className={cn('w-full h-6 rounded-full overflow-hidden', getLoadBgColor(kitchenLoadPct))}>
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-out',
                  getLoadBarColor(kitchenLoadPct),
                )}
                style={{ width: `${Math.min(kitchenLoadPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>0%</span>
              <span className="font-semibold text-sm text-slate-900">
                {kitchenLoadPct.toFixed(0)}%
              </span>
              <span>100%</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Light (&lt;50%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate (50-80%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Heavy (&gt;80%)
              </span>
            </div>
          </div>
        </div>

        {/* Staff recommendation */}
        <div className="card flex flex-col">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Staff Recommendation</h3>
          <p className="text-xs text-slate-500 mb-4">AI-powered staffing suggestion</p>
          <div
            className={cn(
              'flex-1 flex items-center gap-4 rounded-xl border px-5 py-6',
              severityStyles[recommendation.severity],
            )}
          >
            <recommendation.icon
              className={cn('w-8 h-8 flex-shrink-0', severityIconStyles[recommendation.severity])}
            />
            <p className="text-sm font-medium leading-relaxed">
              {recommendation.message}
            </p>
          </div>
        </div>
      </div>

      {/* Peak hours chart */}
      <AIChartCard
        title="Peak Hours"
        subtitle="Order distribution across 24 hours"
      >
        {peakChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={peakChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval={1}
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
                formatter={(value: number) => [value, 'Orders']}
              />
              <Bar
                dataKey="orders"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[320px] text-sm text-slate-400">
            No peak hours data available
          </div>
        )}
      </AIChartCard>
    </div>
  )
}
