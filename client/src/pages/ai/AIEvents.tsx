import { useState, useMemo, useCallback } from 'react'
import {
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SignalIcon,
  InboxIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  CubeIcon,
  ChartBarIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'

import { useAIPolling, useAIQuery } from '../../hooks/useAIQuery'
import { aiEventsApi } from '../../services/aiApi'
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
// Constants & helpers
// ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 10_000
const PAGE_SIZE = 50

function statusBadgeVariant(status: string): 'green' | 'red' | 'yellow' | 'gray' {
  if (status === 'processed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'pending') return 'yellow'
  return 'gray'
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  OrderCompleted: ShoppingCartIcon,
  InsightGenerated: SparklesIcon,
  CustomerSegmented: UserGroupIcon,
  InventoryAlert: ExclamationTriangleIcon,
  ModelTrained: CubeIcon,
  RevenueForecast: ChartBarIcon,
  RecommendationGenerated: SparklesIcon,
  AlertTriggered: BellAlertIcon,
}

function getEventIcon(eventName: string): React.ElementType {
  // Match known event types by checking if the event name starts with or contains them
  for (const [key, icon] of Object.entries(EVENT_ICONS)) {
    if (eventName.includes(key) || eventName.startsWith(key)) return icon
  }
  return BoltIcon
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

// Color palette for event type badges
const EVENT_TYPE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
]

function getEventTypeColor(index: number): string {
  return EVENT_TYPE_COLORS[index % EVENT_TYPE_COLORS.length]
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface EventItem {
  event_id: string
  event_name: string
  restaurant_id: string
  status: string
  created_at: string
  data: Record<string, unknown>
}

interface EventsListResponse {
  items: EventItem[]
  total: number
  page: number
  page_size: number
  pages: number
}

interface EventsStats {
  total_events: number
  processed: number
  failed: number
  pending: number
  retries: number
  average_processing_time_ms: number
  throughput_per_minute: number
  event_types: Record<string, number>
  dead_letter_count: number
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AIEvents() {
  const [page, setPage] = useState(1)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('')

  // ── Data fetching ─────────────────────────────────────────────
  const stats = useAIQuery<EventsStats>(
    () => aiEventsApi.stats().then((r) => ({ data: r.data?.data ?? r.data })),
  )

  const events = useAIPolling<EventsListResponse>(
    () =>
      aiEventsApi
        .list({
          page,
          page_size: PAGE_SIZE,
          ...(filterType ? { event_type: filterType } : {}),
        })
        .then((r) => ({ data: r.data?.data ?? r.data })),
    POLL_INTERVAL,
    [page, filterType],
  )

  // ── Derived values ────────────────────────────────────────────
  const statsData = stats.data
  const eventsList = events.data?.items ?? []
  const totalPages = events.data?.pages ?? 1
  const totalEvents = events.data?.total ?? 0
  const eventTypes = statsData?.event_types ?? {}
  const eventTypeNames = useMemo(() => Object.keys(eventTypes).sort(), [eventTypes])

  // ── Toggle expand ─────────────────────────────────────────────
  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEvent((prev) => (prev === eventId ? null : eventId))
  }, [])

  // ── Filter change ─────────────────────────────────────────────
  const handleFilterChange = useCallback((type: string) => {
    setFilterType(type)
    setPage(1)
  }, [])

  // ── Loading / error states ────────────────────────────────────
  const isLoading = (stats.loading && !stats.data) && (events.loading && !events.data)
  const hasError = (stats.error && !stats.data) && (events.error && !events.data)

  if (hasError) {
    return (
      <div className="p-6">
        <AIPageHeader title="Event Monitor" subtitle="Real-time event stream" />
        <AIErrorState
          message={stats.error ?? events.error ?? 'Failed to load event data'}
          onRetry={() => {
            stats.refetch()
            events.refetch()
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <AIPageHeader title="Event Monitor" subtitle="Real-time event stream" />
        <AILoadingGrid count={6} />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Event Monitor"
        subtitle="Real-time event stream"
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Auto-refresh 10s
            </span>
            <button
              onClick={() => {
                stats.refetch()
                events.refetch()
              }}
              className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <AIStatCard
          title="Total Events"
          value={statsData?.total_events?.toLocaleString('en-IN') ?? '--'}
          icon={BoltIcon}
          color="blue"
          loading={stats.loading && !statsData}
        />
        <AIStatCard
          title="Processed"
          value={statsData?.processed?.toLocaleString('en-IN') ?? '--'}
          icon={CheckCircleIcon}
          color="green"
          loading={stats.loading && !statsData}
        />
        <AIStatCard
          title="Failed"
          value={statsData?.failed?.toLocaleString('en-IN') ?? '--'}
          icon={XCircleIcon}
          color={statsData && statsData.failed > 0 ? 'red' : 'green'}
          loading={stats.loading && !statsData}
        />
        <AIStatCard
          title="Pending"
          value={statsData?.pending?.toLocaleString('en-IN') ?? '--'}
          icon={ClockIcon}
          color="amber"
          loading={stats.loading && !statsData}
        />
        <AIStatCard
          title="Throughput/min"
          value={
            statsData?.throughput_per_minute !== undefined
              ? statsData.throughput_per_minute.toFixed(1)
              : '--'
          }
          icon={SignalIcon}
          color="purple"
          loading={stats.loading && !statsData}
        />
        <AIStatCard
          title="Dead Letters"
          value={statsData?.dead_letter_count?.toLocaleString('en-IN') ?? '--'}
          icon={InboxIcon}
          color={statsData && statsData.dead_letter_count > 0 ? 'red' : 'green'}
          loading={stats.loading && !statsData}
        />
      </div>

      {/* Event type distribution */}
      {eventTypeNames.length > 0 && (
        <AIChartCard title="Event Type Distribution" subtitle="Breakdown by event type">
          <div className="flex flex-wrap gap-2">
            {eventTypeNames.map((type, i) => (
              <button
                key={type}
                onClick={() => handleFilterChange(filterType === type ? '' : type)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  filterType === type
                    ? 'ring-2 ring-brand-500 ring-offset-1'
                    : 'hover:opacity-80',
                  getEventTypeColor(i),
                )}
              >
                {type}
                <span className="font-bold">{eventTypes[type]}</span>
              </button>
            ))}
          </div>
        </AIChartCard>
      )}

      {/* Event list */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BoltIcon className="w-4 h-4 text-slate-500" />
              Event Stream
            </h3>
            <span className="text-xs text-slate-400">
              {totalEvents.toLocaleString('en-IN')} total
            </span>
          </div>

          {/* Filter dropdown */}
          <div className="flex items-center gap-2">
            {filterType && (
              <button
                onClick={() => handleFilterChange('')}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Clear filter
              </button>
            )}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => handleFilterChange(e.target.value)}
                className={cn(
                  'appearance-none text-xs pl-7 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                  'text-slate-700 cursor-pointer',
                )}
              >
                <option value="">All Types</option>
                {eventTypeNames.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <FunnelIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Event rows */}
        {events.loading && !events.data ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <ArrowPathIcon className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : eventsList.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            {filterType ? `No events of type "${filterType}"` : 'No events found'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {eventsList.map((event) => {
              const isExpanded = expandedEvent === event.event_id
              const EventIcon = getEventIcon(event.event_name)
              return (
                <div key={event.event_id} className="hover:bg-slate-50/50 transition-colors">
                  <button
                    onClick={() => toggleExpand(event.event_id)}
                    className="w-full px-6 py-3 flex items-center gap-4 text-left"
                  >
                    {/* Expand chevron */}
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    {/* Event icon */}
                    <div className="flex-shrink-0 p-1.5 rounded-lg bg-slate-100">
                      <EventIcon className="w-4 h-4 text-slate-600" />
                    </div>

                    {/* Event name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {event.event_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        ID: {event.event_id}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <AIBadge
                        label={statusLabel(event.status)}
                        variant={statusBadgeVariant(event.status)}
                      />
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-xs text-slate-500 hidden sm:block">
                      {formatTimestamp(event.created_at)}
                    </div>
                  </button>

                  {/* Expanded detail view */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pl-[4.5rem]">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500">Event ID</span>
                            <p className="font-mono text-slate-700 mt-0.5 break-all">
                              {event.event_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Restaurant ID</span>
                            <p className="font-mono text-slate-700 mt-0.5 break-all">
                              {event.restaurant_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Created At</span>
                            <p className="text-slate-700 mt-0.5">
                              {new Date(event.created_at).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        {/* Event data as JSON */}
                        <div>
                          <span className="text-xs text-slate-500">Event Data</span>
                          <pre className="mt-1 text-xs font-mono text-slate-700 bg-white rounded-lg border border-slate-200 p-3 overflow-x-auto max-h-64 overflow-y-auto">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  page <= 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
                )}
              >
                Previous
              </button>

              {/* Page number buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'w-8 h-8 text-xs font-medium rounded-lg transition-colors',
                      pageNum === page
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  page >= totalPages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
                )}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
