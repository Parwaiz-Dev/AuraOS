import { useState } from 'react'
import {
  CpuChipIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HandRaisedIcon,
  BoltIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAIQuery, useAIPolling } from '../../hooks/useAIQuery'
import { aiAutonomyApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIErrorState,
  AIEmptyState,
  AIBadge,
  AITabButton,
  AILoadingGrid,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

const POLL_INTERVAL = 30_000

type AutonomyStatus = {
  enabled: boolean
  running_actions: number
  total_executions: number
  pending_approvals: number
  confidence_threshold: number
  risk_tolerance: string
}

type RegisteredAction = {
  action_name: string
  description: string
  risk_level: string
  requires_approval: boolean
  last_run: string | null
  run_count: number
}

type PendingApproval = {
  request_id: string
  action_name: string
  description: string
  risk_level: string
  confidence: number
  parameters: Record<string, unknown>
  created_at: string
  restaurant_id: string
}

type HistoryEntry = {
  action_name: string
  status: string
  risk_level: string
  confidence: number
  executed_at: string
  result: unknown
}

const riskConfig: Record<string, { variant: 'green' | 'yellow' | 'red'; label: string }> = {
  low: { variant: 'green', label: 'Low' },
  medium: { variant: 'yellow', label: 'Medium' },
  high: { variant: 'red', label: 'High' },
  critical: { variant: 'red', label: 'Critical' },
}

const statusConfig: Record<string, { variant: 'blue' | 'green' | 'red' | 'gray'; label: string }> = {
  running: { variant: 'blue', label: 'Running' },
  completed: { variant: 'green', label: 'Completed' },
  success: { variant: 'green', label: 'Success' },
  failed: { variant: 'red', label: 'Failed' },
  rejected: { variant: 'gray', label: 'Rejected' },
  cancelled: { variant: 'gray', label: 'Cancelled' },
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

function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export default function AIAutonomy() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'actions' | 'history'>('approvals')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const status = useAIPolling<AutonomyStatus>(
    () => aiAutonomyApi.status().then((r) => ({ data: r.data?.data ?? r.data })),
    POLL_INTERVAL,
  )

  const actions = useAIQuery<RegisteredAction[]>(
    () => aiAutonomyApi.actions().then((r) => ({ data: r.data?.data ?? r.data })),
  )

  const approvals = useAIPolling<PendingApproval[]>(
    () => aiAutonomyApi.pendingApprovals().then((r) => ({ data: r.data?.data ?? r.data })),
    POLL_INTERVAL,
  )

  const history = useAIQuery<HistoryEntry[]>(
    () => aiAutonomyApi.history({ limit: 50 }).then((r) => ({ data: r.data?.data ?? r.data })),
  )

  const statusData = status.data
  const actionList = actions.data
  const approvalList = approvals.data
  const historyList = history.data

  const isLoading = status.loading && !status.data
  const hasError = status.error && !status.data

  async function handleApprove(requestId: string) {
    setProcessingId(requestId)
    try {
      await aiAutonomyApi.approve(requestId)
      toast.success('Action approved')
      approvals.refetch()
      status.refetch()
      history.refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve action'
      toast.error(message)
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(requestId: string) {
    setProcessingId(requestId)
    try {
      await aiAutonomyApi.reject(requestId)
      toast.success('Action rejected')
      approvals.refetch()
      status.refetch()
      history.refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject action'
      toast.error(message)
    } finally {
      setProcessingId(null)
    }
  }

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader title="Autonomous AI" subtitle="Manage autonomous AI actions and approvals" />
        <AIErrorState
          message={status.error ?? 'Failed to load autonomy data'}
          onRetry={status.refetch}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader title="Autonomous AI" subtitle="Manage autonomous AI actions and approvals" />
        <AILoadingGrid count={4} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Autonomous AI"
        subtitle="Manage autonomous AI actions and approvals"
        actions={
          <button
            onClick={() => { status.refetch(); actions.refetch(); approvals.refetch(); history.refetch() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* Status Banner */}
      <div className={cn(
        'rounded-xl border px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2',
        statusData?.enabled
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-slate-50 border-slate-200',
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2.5 h-2.5 rounded-full',
            statusData?.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
          )} />
          <span className="text-sm font-semibold text-slate-900">
            {statusData?.enabled ? 'Autonomy Enabled' : 'Autonomy Disabled'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <PlayIcon className="w-3.5 h-3.5" />
          <span>{statusData?.running_actions ?? 0} running actions</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
          <span>Confidence threshold: {statusData?.confidence_threshold != null ? formatConfidence(statusData.confidence_threshold) : '--'}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AIStatCard
          title="Running Actions"
          value={statusData?.running_actions ?? 0}
          icon={BoltIcon}
          color="blue"
          loading={status.loading}
        />
        <AIStatCard
          title="Total Executions"
          value={statusData?.total_executions ?? 0}
          icon={CpuChipIcon}
          color="indigo"
          loading={status.loading}
        />
        <AIStatCard
          title="Pending Approvals"
          value={statusData?.pending_approvals ?? 0}
          icon={HandRaisedIcon}
          color="amber"
          loading={status.loading}
        />
        <AIStatCard
          title="Risk Tolerance"
          value={statusData?.risk_tolerance ?? '--'}
          icon={ShieldCheckIcon}
          color="green"
          loading={status.loading}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <AITabButton active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')}>
          Pending Approvals
          {(approvalList?.length ?? 0) > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
              {approvalList?.length}
            </span>
          )}
        </AITabButton>
        <AITabButton active={activeTab === 'actions'} onClick={() => setActiveTab('actions')}>
          Registered Actions
        </AITabButton>
        <AITabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          Execution History
        </AITabButton>
      </div>

      {/* Pending Approvals Tab */}
      {activeTab === 'approvals' && (
        <>
          {approvals.loading && !approvals.data ? (
            <AILoadingGrid count={4} />
          ) : approvals.error && !approvals.data ? (
            <AIErrorState message={approvals.error ?? 'Failed to load approvals'} onRetry={approvals.refetch} />
          ) : !approvalList || approvalList.length === 0 ? (
            <AIEmptyState
              icon={CheckCircleIcon}
              title="No Pending Approvals"
              description="All autonomous actions have been reviewed. New approval requests will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvalList.map((approval: PendingApproval) => {
                const risk = riskConfig[approval.risk_level] ?? { variant: 'gray' as const, label: approval.risk_level }
                const isProcessing = processingId === approval.request_id
                const paramEntries = Object.entries(approval.parameters ?? {})
                return (
                  <div key={approval.request_id} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{approval.action_name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{approval.description}</p>
                      </div>
                      <AIBadge label={risk.label} variant={risk.variant} />
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                      <div className="flex items-center gap-1">
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        <span>Confidence: {formatConfidence(approval.confidence)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatTimestamp(approval.created_at)}</span>
                      </div>
                    </div>

                    {paramEntries.length > 0 && (
                      <div className="mb-4 bg-slate-50 rounded-lg p-3 space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Parameters</span>
                        {paramEntries.map(([key, val]) => (
                          <div key={key} className="flex items-baseline justify-between text-xs">
                            <span className="text-slate-500 font-mono">{key}</span>
                            <span className="text-slate-700 font-medium truncate ml-2 max-w-[180px]">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleApprove(approval.request_id)}
                        disabled={isProcessing}
                        className={cn(
                          'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                          isProcessing
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700',
                        )}
                      >
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(approval.request_id)}
                        disabled={isProcessing}
                        className={cn(
                          'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                          isProcessing
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700',
                        )}
                      >
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Registered Actions Tab */}
      {activeTab === 'actions' && (
        <>
          {actions.loading && !actions.data ? (
            <AILoadingGrid count={4} />
          ) : actions.error && !actions.data ? (
            <AIErrorState message={actions.error ?? 'Failed to load actions'} onRetry={actions.refetch} />
          ) : !actionList || actionList.length === 0 ? (
            <AIEmptyState
              icon={CpuChipIcon}
              title="No Registered Actions"
              description="No autonomous actions have been registered yet."
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <CpuChipIcon className="w-4 h-4 text-slate-500" />
                  Registered Actions
                  <span className="text-xs font-normal text-slate-500">({actionList.length} total)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Level</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Approval</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Run</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Run Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {actionList.map((action: RegisteredAction) => {
                      const risk = riskConfig[action.risk_level] ?? { variant: 'gray' as const, label: action.risk_level }
                      return (
                        <tr key={action.action_name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-900">{action.action_name}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-[240px] truncate">
                            {action.description}
                          </td>
                          <td className="px-6 py-4">
                            <AIBadge label={risk.label} variant={risk.variant} />
                          </td>
                          <td className="px-6 py-4">
                            {action.requires_approval ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                Required
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Auto</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {formatTimestamp(action.last_run)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-medium text-slate-700">{action.run_count}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
          ) : !historyList || historyList.length === 0 ? (
            <AIEmptyState
              icon={ClockIcon}
              title="No Execution History"
              description="No autonomous actions have been executed yet."
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-slate-500" />
                  Execution History
                  <span className="text-xs font-normal text-slate-500">({historyList.length} entries)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Level</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Confidence</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Executed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map((entry: HistoryEntry, idx: number) => {
                      const risk = riskConfig[entry.risk_level] ?? { variant: 'gray' as const, label: entry.risk_level }
                      const sts = statusConfig[entry.status] ?? { variant: 'gray' as const, label: entry.status }
                      return (
                        <tr key={`${entry.action_name}-${entry.executed_at}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-900">{entry.action_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <AIBadge label={sts.label} variant={sts.variant} />
                          </td>
                          <td className="px-6 py-4">
                            <AIBadge label={risk.label} variant={risk.variant} />
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {formatConfidence(entry.confidence)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {formatTimestamp(entry.executed_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
