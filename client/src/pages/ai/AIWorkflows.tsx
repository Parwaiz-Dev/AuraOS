import { useState } from 'react'
import {
  BoltIcon,
  PlayIcon,
  StopIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  QueueListIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAIQuery, useAIPolling } from '../../hooks/useAIQuery'
import { aiWorkflowApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AIEmptyState,
  AIBadge,
  AITabButton,
  AILoadingGrid,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

const POLL_INTERVAL = 30_000

type WorkflowStats = {
  total_executions: number
  running: number
  completed: number
  failed: number
  average_duration_ms: number
}

type Workflow = {
  workflow_id: string
  name: string
  description: string
  steps: string[]
  category: string
}

type Execution = {
  execution_id: string
  workflow_id: string
  status: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  steps_completed: number
  total_steps: number
  result: unknown
  error: string | null
}

type HistoryResponse = {
  items: Execution[]
  total: number
  page: number
  page_size: number
  pages: number
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '--'
  return new Date(ts).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusConfig: Record<string, { variant: 'blue' | 'green' | 'red' | 'gray'; label: string }> = {
  running: { variant: 'blue', label: 'Running' },
  completed: { variant: 'green', label: 'Completed' },
  failed: { variant: 'red', label: 'Failed' },
  cancelled: { variant: 'gray', label: 'Cancelled' },
}

export default function AIWorkflows() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'history'>('workflows')
  const [historyPage, setHistoryPage] = useState(1)
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const stats = useAIPolling<WorkflowStats>(
    () => aiWorkflowApi.stats().then((r) => ({ data: r.data?.data ?? r.data })),
    POLL_INTERVAL,
  )

  const workflows = useAIQuery<Workflow[]>(
    () => aiWorkflowApi.list().then((r) => ({ data: r.data?.data ?? r.data })),
  )

  const history = useAIPolling<HistoryResponse>(
    () => aiWorkflowApi.history({ page: historyPage, page_size: 20 }).then((r) => ({ data: r.data?.data ?? r.data })),
    POLL_INTERVAL,
    [historyPage],
  )

  const statsData = stats.data?.data ?? stats.data
  const workflowList = workflows.data?.data ?? workflows.data
  const historyData = history.data?.data ?? history.data

  const isLoading = stats.loading && !stats.data
  const hasError = stats.error && !stats.data

  async function handleRun(workflowId: string) {
    setRunningAction(workflowId)
    try {
      await aiWorkflowApi.run({ workflow_id: workflowId })
      toast.success('Workflow started successfully')
      stats.refetch()
      history.refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start workflow'
      toast.error(message)
    } finally {
      setRunningAction(null)
    }
  }

  async function handleCancel(executionId: string) {
    setCancellingId(executionId)
    try {
      await aiWorkflowApi.cancel(executionId)
      toast.success('Workflow cancelled')
      stats.refetch()
      history.refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel workflow'
      toast.error(message)
    } finally {
      setCancellingId(null)
    }
  }

  async function handleRetry(workflowId: string) {
    await handleRun(workflowId)
  }

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader title="Workflow Monitor" subtitle="Manage and monitor AI workflow executions" />
        <AIErrorState
          message={stats.error ?? 'Failed to load workflow data'}
          onRetry={stats.refetch}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader title="Workflow Monitor" subtitle="Manage and monitor AI workflow executions" />
        <AILoadingGrid count={5} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Workflow Monitor"
        subtitle="Manage and monitor AI workflow executions"
        actions={
          <button
            onClick={() => { stats.refetch(); workflows.refetch(); history.refetch() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AIStatCard
          title="Total Executions"
          value={statsData?.total_executions ?? 0}
          icon={BoltIcon}
          color="blue"
          loading={stats.loading}
        />
        <AIStatCard
          title="Running"
          value={statsData?.running ?? 0}
          icon={PlayIcon}
          color="indigo"
          loading={stats.loading}
        />
        <AIStatCard
          title="Completed"
          value={statsData?.completed ?? 0}
          icon={CheckCircleIcon}
          color="green"
          loading={stats.loading}
        />
        <AIStatCard
          title="Failed"
          value={statsData?.failed ?? 0}
          icon={XCircleIcon}
          color="red"
          loading={stats.loading}
        />
        <AIStatCard
          title="Avg Duration"
          value={formatDuration(statsData?.average_duration_ms)}
          icon={ClockIcon}
          color="amber"
          loading={stats.loading}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <AITabButton active={activeTab === 'workflows'} onClick={() => setActiveTab('workflows')}>
          Available Workflows
        </AITabButton>
        <AITabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          Execution History
        </AITabButton>
      </div>

      {/* Available Workflows Tab */}
      {activeTab === 'workflows' && (
        <>
          {workflows.loading && !workflows.data ? (
            <AILoadingGrid count={6} />
          ) : workflows.error && !workflows.data ? (
            <AIErrorState message={workflows.error ?? 'Failed to load workflows'} onRetry={workflows.refetch} />
          ) : !workflowList || workflowList.length === 0 ? (
            <AIEmptyState
              icon={Cog6ToothIcon}
              title="No Workflows Available"
              description="No AI workflows have been registered yet."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflowList.map((wf) => (
                <div key={wf.workflow_id} className="card flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{wf.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{wf.description}</p>
                    </div>
                    <AIBadge label={wf.category} variant="purple" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <QueueListIcon className="w-3.5 h-3.5" />
                    <span>{wf.steps?.length ?? 0} steps</span>
                  </div>
                  {wf.steps && wf.steps.length > 0 && (
                    <div className="mb-4 space-y-1">
                      {wf.steps.slice(0, 4).map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-medium text-slate-600 shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{step}</span>
                        </div>
                      ))}
                      {wf.steps.length > 4 && (
                        <span className="text-xs text-slate-400 pl-6">+{wf.steps.length - 4} more</span>
                      )}
                    </div>
                  )}
                  <div className="mt-auto pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleRun(wf.workflow_id)}
                      disabled={runningAction === wf.workflow_id}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors w-full justify-center',
                        runningAction === wf.workflow_id
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-brand-600 text-white hover:bg-brand-700',
                      )}
                    >
                      <PlayIcon className="w-3.5 h-3.5" />
                      {runningAction === wf.workflow_id ? 'Starting...' : 'Run Workflow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Execution History Tab */}
      {activeTab === 'history' && (
        <>
          {history.loading && !history.data ? (
            <AILoadingGrid count={4} />
          ) : history.error && !history.data ? (
            <AIErrorState message={history.error ?? 'Failed to load history'} onRetry={history.refetch} />
          ) : !historyData?.items || historyData.items.length === 0 ? (
            <AIEmptyState
              icon={ClockIcon}
              title="No Execution History"
              description="No workflow executions have been recorded yet."
            />
          ) : (
            <div className="space-y-4">
              <div className="card overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-slate-500" />
                    Execution History
                    <span className="text-xs font-normal text-slate-500">({historyData.total} total)</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Workflow ID</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Started</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Error</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyData.items.map((exec) => {
                        const cfg = statusConfig[exec.status] ?? { variant: 'gray' as const, label: exec.status }
                        const progress = exec.total_steps > 0
                          ? Math.round((exec.steps_completed / exec.total_steps) * 100)
                          : 0
                        return (
                          <tr key={exec.execution_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs text-slate-700">{exec.workflow_id}</span>
                            </td>
                            <td className="px-6 py-4">
                              <AIBadge label={cfg.label} variant={cfg.variant} />
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600">
                              {formatTimestamp(exec.started_at)}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600">
                              {formatDuration(exec.duration_ms)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      exec.status === 'completed' ? 'bg-emerald-500' :
                                      exec.status === 'failed' ? 'bg-red-500' :
                                      exec.status === 'running' ? 'bg-blue-500' : 'bg-slate-300',
                                    )}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                                  {exec.steps_completed}/{exec.total_steps}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {exec.error ? (
                                <span className="text-xs text-red-600 truncate block max-w-[200px]" title={exec.error}>
                                  {exec.error}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">--</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {exec.status === 'running' && (
                                  <button
                                    onClick={() => handleCancel(exec.execution_id)}
                                    disabled={cancellingId === exec.execution_id}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                                  >
                                    <StopIcon className="w-3 h-3" />
                                    {cancellingId === exec.execution_id ? 'Cancelling...' : 'Cancel'}
                                  </button>
                                )}
                                {exec.status === 'failed' && (
                                  <button
                                    onClick={() => handleRetry(exec.workflow_id)}
                                    disabled={runningAction === exec.workflow_id}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-600 bg-brand-50 rounded-md hover:bg-brand-100 transition-colors disabled:opacity-50"
                                  >
                                    <ArrowPathIcon className="w-3 h-3" />
                                    Retry
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {historyData.pages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Page {historyData.page} of {historyData.pages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyData.page <= 1}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(historyData.pages, p + 1))}
                      disabled={historyData.page >= historyData.pages}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
