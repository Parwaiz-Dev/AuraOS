import { useState, useCallback } from 'react'
import {
  CpuChipIcon,
  BoltIcon,
  PauseCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  EllipsisHorizontalCircleIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline'
import { useAIPolling, useAIQuery } from '../../hooks/useAIQuery'
import { aiAgentsApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIErrorState,
  AILoadingGrid,
  AIBadge,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

const POLL_INTERVAL = 15_000

interface Agent {
  agent_id: string
  name: string
  role: string
  status: string
  current_task: string | null
  memory_size: number
  tasks_completed: number
  last_active: string | null
}

interface AgentMetrics {
  total_agents: number
  active_agents: number
  idle_agents: number
  failed_agents: number
  total_tasks_processed: number
  total_messages: number
  average_task_duration_ms: number
}

interface AgentTask {
  task_id: string
  agent_id: string
  task_type: string
  status: string
  started_at: string | null
  completed_at: string | null
  result: string | null
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; label: string; variant: 'green' | 'yellow' | 'red' | 'gray' }> = {
  active: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', label: 'Active', variant: 'green' },
  idle: { dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200', label: 'Idle', variant: 'yellow' },
  failed: { dot: 'bg-red-500', bg: 'bg-red-50 border-red-200', label: 'Failed', variant: 'red' },
  stopped: { dot: 'bg-slate-400', bg: 'bg-slate-50 border-slate-200', label: 'Stopped', variant: 'gray' },
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  Planner: CubeTransparentIcon,
  Research: ChatBubbleLeftRightIcon,
  Forecast: ClockIcon,
  Inventory: CpuChipIcon,
  Recommendation: BoltIcon,
  Supervisor: EllipsisHorizontalCircleIcon,
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString()
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const GRAPH_ROLES = ['Supervisor', 'Planner', 'Research', 'Forecast', 'Inventory', 'Recommendation']

function AgentGraph({ agents }: { agents: Agent[] }) {
  const agentMap = new Map(agents.map((a) => [a.role, a]))
  const supervisor = agentMap.get('Supervisor')
  const workers = GRAPH_ROLES.filter((r) => r !== 'Supervisor')

  const centerX = 200
  const centerY = 60
  const radius = 120
  const workerPositions = workers.map((_, i) => {
    const angle = (Math.PI / (workers.length - 1)) * i
    return {
      x: centerX + radius * Math.cos(angle - Math.PI),
      y: centerY + radius * Math.sin(angle - Math.PI) + radius + 20,
    }
  })

  function statusColor(role: string): string {
    const agent = agentMap.get(role)
    if (!agent) return '#94a3b8'
    if (agent.status === 'active') return '#10b981'
    if (agent.status === 'idle') return '#f59e0b'
    if (agent.status === 'failed') return '#ef4444'
    return '#94a3b8'
  }

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Agent Execution Graph</h3>
      <div className="flex justify-center overflow-x-auto">
        <svg width="400" height="280" viewBox="0 0 400 280" className="shrink-0">
          {workerPositions.map((pos, i) => (
            <line
              key={`line-${i}`}
              x1={centerX}
              y1={centerY + 18}
              x2={pos.x}
              y2={pos.y - 18}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          ))}

          <circle cx={centerX} cy={centerY} r={28} fill="white" stroke={statusColor('Supervisor')} strokeWidth="2.5" />
          <text x={centerX} y={centerY - 6} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1e293b">
            {supervisor?.name ?? 'Supervisor'}
          </text>
          <text x={centerX} y={centerY + 8} textAnchor="middle" fontSize="8" fill="#64748b">
            Supervisor
          </text>
          <circle cx={centerX + 22} cy={centerY - 20} r={5} fill={statusColor('Supervisor')} />

          {workers.map((role, i) => {
            const pos = workerPositions[i]
            const agent = agentMap.get(role)
            return (
              <g key={role}>
                <circle cx={pos.x} cy={pos.y} r={24} fill="white" stroke={statusColor(role)} strokeWidth="2" />
                <text x={pos.x} y={pos.y - 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="#1e293b">
                  {agent?.name ?? role}
                </text>
                <text x={pos.x} y={pos.y + 8} textAnchor="middle" fontSize="7" fill="#64748b">
                  {role}
                </text>
                <circle cx={pos.x + 18} cy={pos.y - 16} r={4} fill={statusColor(role)} />
              </g>
            )
          })}

          <g transform="translate(10, 260)">
            {['active', 'idle', 'failed', 'stopped'].map((s, i) => (
              <g key={s} transform={`translate(${i * 95}, 0)`}>
                <circle cx={4} cy={4} r={4} fill={STATUS_CONFIG[s].dot.replace('bg-', '').includes('emerald') ? '#10b981' : s === 'idle' ? '#f59e0b' : s === 'failed' ? '#ef4444' : '#94a3b8'} />
                <text x={12} y={8} fontSize="9" fill="#64748b">{STATUS_CONFIG[s].label}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}

export default function AIAgents() {
  const [restartingId, setRestartingId] = useState<string | null>(null)

  const agentsQuery = useAIPolling<Agent[]>(() => aiAgentsApi.list(), POLL_INTERVAL)
  const metricsQuery = useAIPolling<AgentMetrics>(() => aiAgentsApi.metrics(), POLL_INTERVAL)
  const tasksQuery = useAIQuery<AgentTask[]>(() => aiAgentsApi.tasks({ limit: 50 }))

  const agents: Agent[] = (agentsQuery.data as any)?.data ?? agentsQuery.data ?? []
  const metrics: AgentMetrics | null = (metricsQuery.data as any)?.data ?? metricsQuery.data
  const tasks: AgentTask[] = (tasksQuery.data as any)?.data ?? tasksQuery.data ?? []

  const handleRestart = useCallback(async (agentId: string) => {
    setRestartingId(agentId)
    try {
      await aiAgentsApi.restart(agentId)
      toast.success('Agent restart initiated')
      agentsQuery.refetch()
      metricsQuery.refetch()
    } catch {
      toast.error('Failed to restart agent')
    } finally {
      setRestartingId(null)
    }
  }, [agentsQuery.refetch, metricsQuery.refetch])

  const hasError = agentsQuery.error || metricsQuery.error
  const isLoading = (agentsQuery.loading && !agents.length) || (metricsQuery.loading && !metrics)

  if (hasError && !agents.length && !metrics) {
    return (
      <div className="p-6 space-y-6">
        <AIPageHeader title="Multi-Agent AI" subtitle="Orchestrated AI agent swarm" />
        <AIErrorState
          message={agentsQuery.error || metricsQuery.error || 'Failed to load agent data'}
          onRetry={() => { agentsQuery.refetch(); metricsQuery.refetch(); tasksQuery.refetch() }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <AIPageHeader title="Multi-Agent AI" subtitle="Orchestrated AI agent swarm" />
        <AILoadingGrid count={7} />
      </div>
    )
  }

  const statLoading = metricsQuery.loading && !metrics

  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Multi-Agent AI"
        subtitle="Orchestrated AI agent swarm"
        actions={
          <button
            onClick={() => { agentsQuery.refetch(); metricsQuery.refetch(); tasksQuery.refetch() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AIStatCard
          title="Total Agents"
          value={metrics?.total_agents ?? 0}
          icon={CpuChipIcon}
          color="blue"
          loading={statLoading}
        />
        <AIStatCard
          title="Active"
          value={metrics?.active_agents ?? 0}
          icon={BoltIcon}
          color="green"
          loading={statLoading}
        />
        <AIStatCard
          title="Idle"
          value={metrics?.idle_agents ?? 0}
          icon={PauseCircleIcon}
          color="amber"
          loading={statLoading}
        />
        <AIStatCard
          title="Failed"
          value={metrics?.failed_agents ?? 0}
          icon={ExclamationTriangleIcon}
          color="red"
          loading={statLoading}
        />
        <AIStatCard
          title="Tasks Processed"
          value={metrics?.total_tasks_processed ?? 0}
          icon={CheckCircleIcon}
          color="purple"
          loading={statLoading}
        />
        <AIStatCard
          title="Total Messages"
          value={metrics?.total_messages ?? 0}
          icon={ChatBubbleLeftRightIcon}
          color="indigo"
          loading={statLoading}
        />
        <AIStatCard
          title="Avg Task Duration"
          value={metrics ? formatDuration(metrics.average_task_duration_ms) : '--'}
          icon={ClockIcon}
          color="blue"
          loading={statLoading}
        />
      </div>

      {/* Agent cards grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.stopped
            const RoleIcon = ROLE_ICONS[agent.role] ?? CpuChipIcon
            return (
              <div key={agent.agent_id} className={cn('card p-5 border', cfg.bg)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center">
                      <RoleIcon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{agent.name}</h3>
                      <p className="text-xs text-slate-500">{agent.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full', cfg.dot, agent.status === 'active' && 'animate-pulse')} />
                    <AIBadge label={cfg.label} variant={cfg.variant} />
                  </div>
                </div>

                {agent.current_task && (
                  <div className="mb-3 px-2.5 py-1.5 bg-white/60 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 mb-0.5">Current Task</p>
                    <p className="text-xs font-medium text-slate-700 truncate">{agent.current_task}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-xs text-slate-500">Memory</p>
                    <p className="text-sm font-semibold text-slate-800">{formatMemory(agent.memory_size)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tasks</p>
                    <p className="text-sm font-semibold text-slate-800">{agent.tasks_completed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Last Active</p>
                    <p className="text-sm font-semibold text-slate-800">{formatTimestamp(agent.last_active)}</p>
                  </div>
                </div>

                {agent.status === 'failed' && (
                  <button
                    onClick={() => handleRestart(agent.agent_id)}
                    disabled={restartingId === agent.agent_id}
                    className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <ArrowPathIcon className={cn('w-3.5 h-3.5', restartingId === agent.agent_id && 'animate-spin')} />
                    {restartingId === agent.agent_id ? 'Restarting...' : 'Restart Agent'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Agent execution graph */}
      {agents.length > 0 && <AgentGraph agents={agents} />}

      {/* Recent tasks table */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Tasks</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No tasks recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Task ID</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Agent</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Started</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tasks.slice(0, 20).map((task) => {
                  const agent = agents.find((a) => a.agent_id === task.agent_id)
                  const taskStatus = task.status === 'completed' ? 'green'
                    : task.status === 'running' ? 'blue'
                    : task.status === 'failed' ? 'red'
                    : 'gray'
                  return (
                    <tr key={task.task_id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{task.task_id.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 text-slate-700">{agent?.name ?? task.agent_id.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{task.task_type}</td>
                      <td className="py-2.5 px-3">
                        <AIBadge label={task.status} variant={taskStatus as any} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{formatTimestamp(task.started_at)}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{formatTimestamp(task.completed_at)}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs max-w-[200px] truncate">{task.result ?? '--'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
