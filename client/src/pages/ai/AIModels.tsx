import { useState, useCallback } from 'react'
import {
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ChartBarSquareIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

import { useAIQuery } from '../../hooks/useAIQuery'
import { aiModelsApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AILoadingGrid,
  AIBadge,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const MODEL_NAMES = [
  'revenue_forecast',
  'order_forecast',
  'customer_segmentation',
  'recommendation_engine',
  'wait_time_prediction',
  'inventory_prediction',
] as const

function formatModelName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function statusBadgeVariant(status: string): 'green' | 'red' | 'gray' {
  if (status === 'healthy') return 'green'
  if (status === 'failed') return 'red'
  return 'gray'
}

function statusLabel(status: string): string {
  if (status === 'healthy') return 'Healthy'
  if (status === 'failed') return 'Failed'
  if (status === 'no_model') return 'No Model'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface ModelHealth {
  status: string
  active_count: number
  failed_count: number
  total_versions: number
}

interface ModelsHealthData {
  models: Record<string, ModelHealth>
}

interface ModelsMetrics {
  totalModels: number
  healthyModels: number
  failedModels: number
  averageAccuracy: number
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AIModels() {
  const [retrainingModel, setRetrainingModel] = useState<string | null>(null)

  // ── Data fetching ─────────────────────────────────────────────
  const health = useAIQuery<ModelsHealthData>(
    () => aiModelsApi.health().then((r) => ({ data: r.data?.data ?? r.data })),
  )

  const metrics = useAIQuery<ModelsMetrics>(
    () => aiModelsApi.metrics().then((r) => ({ data: r.data?.data ?? r.data })),
  )

  // ── Retrain handler ───────────────────────────────────────────
  const handleRetrain = useCallback(
    async (modelName: string) => {
      setRetrainingModel(modelName)
      try {
        const res = await aiModelsApi.retrain(modelName)
        const result = res.data?.data ?? res.data
        toast.success(result?.message ?? `${formatModelName(modelName)} retrain initiated`)
        health.refetch()
        metrics.refetch()
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ?? err?.message ?? 'Retrain failed'
        toast.error(msg)
      } finally {
        setRetrainingModel(null)
      }
    },
    [health, metrics],
  )

  // ── Loading / error states ────────────────────────────────────
  const isLoading = (health.loading && !health.data) || (metrics.loading && !metrics.data)
  const hasError = (health.error && !health.data) || (metrics.error && !metrics.data)

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader title="Model Management" subtitle="Monitor and retrain AI models" />
        <AIErrorState
          message={health.error ?? metrics.error ?? 'Failed to load model data'}
          onRetry={() => {
            health.refetch()
            metrics.refetch()
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader title="Model Management" subtitle="Monitor and retrain AI models" />
        <AILoadingGrid count={4} />
      </div>
    )
  }

  // ── Derived values ────────────────────────────────────────────
  const models = health.data?.models ?? {}
  const metricsData = metrics.data

  // Build model list from API data, falling back to known model names
  const modelEntries: Array<{ name: string; data: ModelHealth }> = MODEL_NAMES.map((name) => ({
    name,
    data: models[name] ?? { status: 'no_model', active_count: 0, failed_count: 0, total_versions: 0 },
  }))

  // Include any models from the API that aren't in the predefined list
  Object.keys(models).forEach((name) => {
    if (!MODEL_NAMES.includes(name as any)) {
      modelEntries.push({ name, data: models[name] })
    }
  })

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Model Management"
        subtitle="Monitor and retrain AI models"
        actions={
          <button
            onClick={() => {
              health.refetch()
              metrics.refetch()
            }}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            Refresh
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AIStatCard
          title="Total Models"
          value={metricsData?.totalModels ?? modelEntries.length}
          icon={CpuChipIcon}
          color="blue"
          loading={metrics.loading && !metricsData}
        />
        <AIStatCard
          title="Healthy"
          value={metricsData?.healthyModels ?? 0}
          icon={CheckCircleIcon}
          color="green"
          loading={metrics.loading && !metricsData}
          subtitle="models operational"
        />
        <AIStatCard
          title="Failed"
          value={metricsData?.failedModels ?? 0}
          icon={XCircleIcon}
          color={metricsData && metricsData.failedModels > 0 ? 'red' : 'green'}
          loading={metrics.loading && !metricsData}
          subtitle={metricsData && metricsData.failedModels > 0 ? 'needs attention' : 'none failing'}
        />
        <AIStatCard
          title="Average Accuracy"
          value={
            metricsData?.averageAccuracy !== undefined
              ? `${(metricsData.averageAccuracy * 100).toFixed(1)}%`
              : '--'
          }
          icon={SparklesIcon}
          color="purple"
          loading={metrics.loading && !metricsData}
          subtitle="across all models"
        />
      </div>

      {/* Model health visualization */}
      <AIChartCard title="Model Health Overview" subtitle="Status of all registered models">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {modelEntries.map(({ name, data }) => {
            const statusColor =
              data.status === 'healthy'
                ? 'bg-emerald-500'
                : data.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-slate-300'
            const statusRing =
              data.status === 'healthy'
                ? 'ring-emerald-200'
                : data.status === 'failed'
                  ? 'ring-red-200'
                  : 'ring-slate-200'
            return (
              <div
                key={name}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50"
              >
                <div className={cn('w-4 h-4 rounded-full ring-4', statusColor, statusRing)} />
                <span className="text-xs font-medium text-slate-700 text-center leading-tight">
                  {formatModelName(name)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {data.active_count} active
                </span>
              </div>
            )
          })}
        </div>
      </AIChartCard>

      {/* Model registry table */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ChartBarSquareIcon className="w-4 h-4 text-slate-500" />
            Model Registry
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Model Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Failed
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Versions
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modelEntries.map(({ name, data }) => {
                const isRetraining = retrainingModel === name
                return (
                  <tr key={name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CubeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-900">
                          {formatModelName(name)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <AIBadge
                        label={statusLabel(data.status)}
                        variant={statusBadgeVariant(data.status)}
                      />
                    </td>
                    <td className="px-6 py-4 text-center text-slate-700">
                      {data.active_count}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          'font-medium',
                          data.failed_count > 0 ? 'text-red-600' : 'text-slate-700',
                        )}
                      >
                        {data.failed_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-700">
                      {data.total_versions}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRetrain(name)}
                        disabled={isRetraining}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          isRetraining
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-brand-50 text-brand-600 hover:bg-brand-100',
                        )}
                      >
                        <ArrowPathIcon
                          className={cn('w-3.5 h-3.5', isRetraining && 'animate-spin')}
                        />
                        {isRetraining ? 'Retraining...' : 'Retrain'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {modelEntries.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No models registered
          </div>
        )}
      </div>
    </div>
  )
}
