import { useState } from 'react'
import {
  ServerStackIcon,
  CpuChipIcon,
  CircleStackIcon,
  SignalIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

import { useAIPolling } from '../../hooks/useAIQuery'
import { aiHealthApi } from '../../services/aiApi'
import {
  AIPageHeader,
  AIErrorState,
  AILoadingGrid,
  AIBadge,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

const POLL_INTERVAL = 30_000

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

function statusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  const s = status?.toLowerCase() ?? ''
  if (s === 'healthy' || s === 'connected' || s === 'ok' || s === 'running' || s === 'success' || s === 'recovered')
    return 'green'
  if (s === 'degraded' || s === 'warning' || s === 'slow') return 'yellow'
  if (s === 'unhealthy' || s === 'disconnected' || s === 'error' || s === 'failed' || s === 'critical')
    return 'red'
  return 'gray'
}

function statusBannerClasses(status: string): string {
  const c = statusColor(status)
  if (c === 'green') return 'bg-emerald-50 border-emerald-200 text-emerald-800'
  if (c === 'yellow') return 'bg-amber-50 border-amber-200 text-amber-800'
  if (c === 'red') return 'bg-red-50 border-red-200 text-red-800'
  return 'bg-slate-50 border-slate-200 text-slate-800'
}

function statusDot(status: string): string {
  const c = statusColor(status)
  if (c === 'green') return 'bg-emerald-500'
  if (c === 'yellow') return 'bg-amber-500'
  if (c === 'red') return 'bg-red-500'
  return 'bg-slate-400'
}

const componentIcons: Record<string, React.ElementType> = {
  database: CircleStackIcon,
  redis: BoltIcon,
  qdrant: CubeIcon,
  fastapi: ServerStackIcon,
  'node api': GlobeAltIcon,
  node: GlobeAltIcon,
}

function getComponentIcon(name: string): React.ElementType {
  const key = name.toLowerCase()
  for (const [k, icon] of Object.entries(componentIcons)) {
    if (key.includes(k)) return icon
  }
  return ServerStackIcon
}

function severityVariant(severity: string): 'red' | 'yellow' | 'blue' | 'gray' {
  const s = severity?.toLowerCase() ?? ''
  if (s === 'critical' || s === 'high') return 'red'
  if (s === 'warning' || s === 'medium') return 'yellow'
  if (s === 'info' || s === 'low') return 'blue'
  return 'gray'
}

// ────────────────────────────────────────────────────────────────
// Progress bar component
// ────────────────────────────────────────────────────────────────

function ResourceBar({
  label,
  value,
  icon: Icon,
  unit = '%',
}: {
  label: string
  value: number
  icon: React.ElementType
  unit?: string
}) {
  const pct = unit === '%' ? Math.min(value, 100) : Math.min((value / 1000) * 100, 100)
  const barColor =
    pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {unit}
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AISystemHealth() {
  const [recovering, setRecovering] = useState<string | null>(null)

  // ── Data fetching with 30s auto-refresh ─────────────────────
  const system = useAIPolling(() => aiHealthApi.system(), POLL_INTERVAL)
  const metrics = useAIPolling(() => aiHealthApi.metrics(), POLL_INTERVAL)
  const agents = useAIPolling(() => aiHealthApi.agents(), POLL_INTERVAL)
  const workflows = useAIPolling(() => aiHealthApi.workflows(), POLL_INTERVAL)
  const anomalies = useAIPolling(
    () => aiHealthApi.anomalies({ limit: 20 }),
    POLL_INTERVAL,
  )
  const recovery = useAIPolling(
    () => aiHealthApi.recovery({ limit: 20 }),
    POLL_INTERVAL,
  )
  const check = useAIPolling(() => aiHealthApi.check(), POLL_INTERVAL)

  // ── Derived data ────────────────────────────────────────────
  const sysData = system.data as any
  const metricsData = metrics.data as any
  const agentsData = agents.data as any
  const workflowsData = workflows.data as any
  const anomalyList: any[] = Array.isArray(anomalies.data) ? anomalies.data : []
  const recoveryList: any[] = Array.isArray(recovery.data) ? recovery.data : []
  const checkData = check.data as any

  const overallStatus: string = sysData?.status ?? checkData?.status ?? 'unknown'
  const components: Record<string, any> = sysData?.components ?? {}
  const uptimeSeconds: number = sysData?.uptime_seconds ?? 0

  // ── Recovery handler ────────────────────────────────────────
  async function handleRecover(component: string) {
    setRecovering(component)
    try {
      const res = await aiHealthApi.recover(component)
      const result = res.data as any
      if (result?.recovered) {
        toast.success(result.message ?? `${component} recovered successfully`)
      } else {
        toast.error(result?.message ?? `Failed to recover ${component}`)
      }
      system.refetch()
      recovery.refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? 'Recovery failed')
    } finally {
      setRecovering(null)
    }
  }

  function handleRefreshAll() {
    system.refetch()
    metrics.refetch()
    agents.refetch()
    workflows.refetch()
    anomalies.refetch()
    recovery.refetch()
    check.refetch()
    toast.success('Refreshing all health data')
  }

  // ── Loading / error ─────────────────────────────────────────
  const isLoading = system.loading && !system.data && check.loading && !check.data
  const hasError = system.error && !system.data && check.error && !check.data

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader title="System Health" subtitle="Monitor AI platform infrastructure" />
        <AIErrorState
          message={system.error ?? check.error ?? 'Failed to load health data'}
          onRetry={handleRefreshAll}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader title="System Health" subtitle="Monitor AI platform infrastructure" />
        <AILoadingGrid count={8} />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <AIPageHeader
        title="System Health"
        subtitle="Monitor AI platform infrastructure"
        actions={
          <div className="flex items-center gap-2">
            {sysData?.last_check && (
              <span className="text-xs text-slate-400">
                Checked {formatTimestamp(sysData.last_check)}
              </span>
            )}
            <button
              onClick={handleRefreshAll}
              className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors flex items-center gap-1.5"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Refresh All
            </button>
          </div>
        }
      />

      {/* Overall Status Banner */}
      <div
        className={cn(
          'flex items-center justify-between rounded-2xl border px-6 py-4',
          statusBannerClasses(overallStatus),
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'w-3 h-3 rounded-full animate-pulse',
              statusDot(overallStatus),
            )}
          />
          <div>
            <p className="text-sm font-semibold capitalize">
              System {overallStatus}
            </p>
            <p className="text-xs opacity-75">
              {Object.keys(components).length} components monitored
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            {uptimeSeconds > 0 ? formatUptime(uptimeSeconds) : '--'}
          </p>
          <p className="text-xs opacity-75">Uptime</p>
        </div>
      </div>

      {/* Service Quick Check (from /health endpoint) */}
      {checkData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {['service', 'database', 'redis'].map((key) => {
            const val = checkData[key]
            if (val === undefined) return null
            const label = key.charAt(0).toUpperCase() + key.slice(1)
            const isOk =
              val === true ||
              val === 'connected' ||
              val === 'ok' ||
              val === 'healthy' ||
              val === 'running'
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-4 py-3',
                  isOk
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-red-50/50 border-red-200',
                )}
              >
                {isOk ? (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p
                    className={cn(
                      'text-sm font-semibold truncate',
                      isOk ? 'text-emerald-700' : 'text-red-700',
                    )}
                  >
                    {typeof val === 'string' ? val : isOk ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
              </div>
            )
          })}
          {checkData?.version && (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
              <ShieldCheckIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Version</p>
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {checkData.version}
                </p>
              </div>
            </div>
          )}
          {checkData?.status && (
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-4 py-3',
                statusColor(checkData.status) === 'green'
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : statusColor(checkData.status) === 'yellow'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-red-50/50 border-red-200',
              )}
            >
              <SignalIcon
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  statusColor(checkData.status) === 'green'
                    ? 'text-emerald-600'
                    : statusColor(checkData.status) === 'yellow'
                      ? 'text-amber-600'
                      : 'text-red-600',
                )}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Status</p>
                <p className="text-sm font-semibold capitalize truncate">
                  {checkData.status}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Service Status Cards Grid */}
      {Object.keys(components).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <ServerStackIcon className="w-4 h-4 text-slate-500" />
            Component Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {Object.entries(components).map(([name, comp]: [string, any]) => {
              const Icon = getComponentIcon(name)
              const color = statusColor(comp?.status)
              const borderClass =
                color === 'green'
                  ? 'border-emerald-200'
                  : color === 'yellow'
                    ? 'border-amber-200'
                    : color === 'red'
                      ? 'border-red-200'
                      : 'border-slate-200'
              const bgClass =
                color === 'green'
                  ? 'bg-emerald-50'
                  : color === 'yellow'
                    ? 'bg-amber-50'
                    : color === 'red'
                      ? 'bg-red-50'
                      : 'bg-slate-50'
              const iconColor =
                color === 'green'
                  ? 'text-emerald-600'
                  : color === 'yellow'
                    ? 'text-amber-600'
                    : color === 'red'
                      ? 'text-red-600'
                      : 'text-slate-500'

              return (
                <div
                  key={name}
                  className={cn(
                    'card border transition-shadow hover:shadow-card-hover',
                    borderClass,
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2 rounded-xl', bgClass)}>
                      <Icon className={cn('w-5 h-5', iconColor)} />
                    </div>
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full mt-1',
                        statusDot(comp?.status),
                      )}
                    />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">
                    {comp?.status ?? 'Unknown'}
                  </p>
                  {comp?.latency_ms !== undefined && (
                    <p className="text-xs text-slate-400 mt-1">
                      {comp.latency_ms.toFixed(0)}ms latency
                    </p>
                  )}
                  {comp?.details && typeof comp.details === 'string' && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {comp.details}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Resource Metrics */}
      {metricsData && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CpuChipIcon className="w-4 h-4 text-slate-500" />
            Resource Metrics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metricsData.cpu_percent !== undefined && (
              <ResourceBar
                label="CPU Usage"
                value={metricsData.cpu_percent}
                icon={CpuChipIcon}
              />
            )}
            {metricsData.memory_percent !== undefined && (
              <ResourceBar
                label="Memory Usage"
                value={metricsData.memory_percent}
                icon={ServerStackIcon}
              />
            )}
            {metricsData.disk_percent !== undefined && (
              <ResourceBar
                label="Disk Usage"
                value={metricsData.disk_percent}
                icon={CircleStackIcon}
              />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {metricsData.response_time_ms !== undefined && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Response Time</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {metricsData.response_time_ms.toFixed(0)}ms
                </span>
              </div>
            )}
            {metricsData.active_connections !== undefined && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <SignalIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Active Connections</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {metricsData.active_connections}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model / Agent Health and Workflow Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent / Model Health */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CubeIcon className="w-4 h-4 text-slate-500" />
            Model / Agent Health
          </h3>
          {agentsData ? (
            <div className="space-y-3">
              {typeof agentsData === 'object' && !Array.isArray(agentsData) ? (
                Object.entries(agentsData).map(([key, val]: [string, any]) => {
                  if (typeof val === 'object' && val !== null && val.status) {
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              statusDot(val.status),
                            )}
                          />
                          <span className="text-sm font-medium text-slate-700 capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {val.latency_ms !== undefined && (
                            <span className="text-xs text-slate-400">
                              {val.latency_ms.toFixed(0)}ms
                            </span>
                          )}
                          <AIBadge
                            label={val.status}
                            variant={statusColor(val.status)}
                          />
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-slate-500">
                        {typeof val === 'string' || typeof val === 'number'
                          ? String(val)
                          : JSON.stringify(val)}
                      </span>
                    </div>
                  )
                })
              ) : Array.isArray(agentsData) ? (
                agentsData.map((agent: any, i: number) => (
                  <div
                    key={agent.name ?? i}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          statusDot(agent.status ?? 'unknown'),
                        )}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {agent.name ?? `Agent ${i + 1}`}
                      </span>
                    </div>
                    <AIBadge
                      label={agent.status ?? 'unknown'}
                      variant={statusColor(agent.status ?? 'unknown')}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No agent health data available
                </p>
              )}
            </div>
          ) : agents.loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No agent health data available
            </p>
          )}
        </div>

        {/* Workflow / Scheduler Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BoltIcon className="w-4 h-4 text-slate-500" />
            Scheduler / Workers
          </h3>
          {workflowsData ? (
            <div className="space-y-3">
              {typeof workflowsData === 'object' &&
              !Array.isArray(workflowsData) ? (
                Object.entries(workflowsData).map(
                  ([key, val]: [string, any]) => {
                    if (typeof val === 'object' && val !== null && val.status) {
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                statusDot(val.status),
                              )}
                            />
                            <span className="text-sm font-medium text-slate-700 capitalize">
                              {key.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {val.circuit_breaker !== undefined && (
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full font-medium',
                                  val.circuit_breaker === 'closed' || val.circuit_breaker === false
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700',
                                )}
                              >
                                CB: {typeof val.circuit_breaker === 'boolean'
                                  ? val.circuit_breaker
                                    ? 'Open'
                                    : 'Closed'
                                  : val.circuit_breaker}
                              </span>
                            )}
                            <AIBadge
                              label={val.status}
                              variant={statusColor(val.status)}
                            />
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-slate-700 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-slate-500">
                          {typeof val === 'string' || typeof val === 'number'
                            ? String(val)
                            : JSON.stringify(val)}
                        </span>
                      </div>
                    )
                  },
                )
              ) : Array.isArray(workflowsData) ? (
                workflowsData.map((wf: any, i: number) => (
                  <div
                    key={wf.name ?? i}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          statusDot(wf.status ?? 'unknown'),
                        )}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {wf.name ?? `Workflow ${i + 1}`}
                      </span>
                    </div>
                    <AIBadge
                      label={wf.status ?? 'unknown'}
                      variant={statusColor(wf.status ?? 'unknown')}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No workflow data available
                </p>
              )}
            </div>
          ) : workflows.loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No workflow data available
            </p>
          )}
        </div>
      </div>

      {/* Recent Anomalies Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
          Recent Anomalies
        </h3>
        {anomalyList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Component
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Detected At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {anomalyList.map((anomaly: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-700 capitalize whitespace-nowrap">
                      {anomaly.type ?? '--'}
                    </td>
                    <td className="py-2.5 px-3">
                      <AIBadge
                        label={anomaly.severity ?? 'unknown'}
                        variant={severityVariant(anomaly.severity)}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                      {anomaly.message ?? '--'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {anomaly.component ?? '--'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {anomaly.detected_at
                        ? formatTimestamp(anomaly.detected_at)
                        : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : anomalies.loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <CheckCircleIcon className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm text-slate-500">No anomalies detected</p>
          </div>
        )}
      </div>

      {/* Recovery History Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-4 h-4 text-slate-500" />
          Recovery History
        </h3>
        {recoveryList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Component
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recoveryList.map((rec: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-700 capitalize whitespace-nowrap">
                      {rec.component ?? '--'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {rec.action ?? '--'}
                    </td>
                    <td className="py-2.5 px-3">
                      <AIBadge
                        label={rec.status ?? 'unknown'}
                        variant={statusColor(rec.status)}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {rec.timestamp
                        ? formatTimestamp(rec.timestamp)
                        : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {rec.component && (
                        <button
                          onClick={() => handleRecover(rec.component)}
                          disabled={recovering === rec.component}
                          className={cn(
                            'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                            recovering === rec.component
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-brand-50 text-brand-600 hover:bg-brand-100',
                          )}
                        >
                          <ArrowPathIcon
                            className={cn(
                              'w-3.5 h-3.5',
                              recovering === rec.component && 'animate-spin',
                            )}
                          />
                          Recover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : recovery.loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <ShieldCheckIcon className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm text-slate-500">No recovery events recorded</p>
          </div>
        )}
      </div>
    </div>
  )
}
