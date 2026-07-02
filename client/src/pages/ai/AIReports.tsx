import { useState, useMemo, useCallback } from 'react'
import {
  DocumentTextIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

import { useAIQuery } from '../../hooks/useAIQuery'
import { aiInsightsApi } from '../../services/aiApi'
import {
  AIPageHeader,
  AIChartCard,
  AIErrorState,
  AIEmptyState,
  AIBadge,
  AITabButton,
  AILoadingGrid,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'

type Tab = 'daily' | 'weekly' | 'history'

const severityVariant: Record<string, 'red' | 'yellow' | 'blue' | 'gray'> = {
  high: 'red',
  medium: 'yellow',
  low: 'blue',
}

function formatReportDate(dateStr: string | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildTextReport(data: any, type: 'daily' | 'weekly'): string {
  const lines: string[] = []
  lines.push(`=== AI ${type === 'daily' ? 'Daily' : 'Weekly'} Report ===`)
  lines.push(`Generated: ${data.generated_at ?? new Date().toISOString()}`)
  if (data.restaurant_id) lines.push(`Restaurant: ${data.restaurant_id}`)
  if (type === 'weekly' && data.week_start && data.week_end) {
    lines.push(`Week: ${data.week_start} to ${data.week_end}`)
  }
  lines.push('')

  if (data.summary) {
    lines.push('--- Summary ---')
    lines.push(data.summary)
    lines.push('')
  }

  if (Array.isArray(data.anomalies) && data.anomalies.length > 0) {
    lines.push('--- Anomalies ---')
    data.anomalies.forEach((a: any, i: number) => {
      const desc = typeof a === 'string' ? a : a.description ?? a.title ?? JSON.stringify(a)
      const sev = typeof a === 'object' ? a.severity ?? '' : ''
      lines.push(`${i + 1}. [${sev.toUpperCase() || 'N/A'}] ${desc}`)
    })
    lines.push('')
  }

  if (Array.isArray(data.trends) && data.trends.length > 0) {
    lines.push('--- Trends ---')
    data.trends.forEach((t: any, i: number) => {
      const desc = typeof t === 'string' ? t : t.description ?? t.title ?? JSON.stringify(t)
      const dir = typeof t === 'object' ? t.direction ?? '' : ''
      lines.push(`${i + 1}. ${dir ? `[${dir.toUpperCase()}] ` : ''}${desc}`)
    })
    lines.push('')
  }

  if (Array.isArray(data.opportunities) && data.opportunities.length > 0) {
    lines.push('--- Opportunities ---')
    data.opportunities.forEach((o: any, i: number) => {
      const desc = typeof o === 'string' ? o : o.title ?? o.description ?? JSON.stringify(o)
      const conf = typeof o === 'object' && o.confidence != null ? ` (${(o.confidence * 100).toFixed(0)}% confidence)` : ''
      lines.push(`${i + 1}. ${desc}${conf}`)
    })
    lines.push('')
  }

  if (Array.isArray(data.risks) && data.risks.length > 0) {
    lines.push('--- Risks ---')
    data.risks.forEach((r: any, i: number) => {
      const desc = typeof r === 'string' ? r : r.description ?? r.title ?? JSON.stringify(r)
      const sev = typeof r === 'object' ? r.severity ?? '' : ''
      const mit = typeof r === 'object' && r.mitigation ? ` | Mitigation: ${r.mitigation}` : ''
      lines.push(`${i + 1}. [${sev.toUpperCase() || 'N/A'}] ${desc}${mit}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

function buildCSVReport(data: any, type: 'daily' | 'weekly'): string {
  const rows: string[][] = []
  rows.push(['Section', 'Index', 'Severity', 'Direction', 'Confidence', 'Description', 'Mitigation'])

  const addItems = (section: string, items: any[]) => {
    items.forEach((item, i) => {
      const desc = typeof item === 'string' ? item : item.description ?? item.title ?? JSON.stringify(item)
      const sev = typeof item === 'object' ? item.severity ?? '' : ''
      const dir = typeof item === 'object' ? item.direction ?? '' : ''
      const conf = typeof item === 'object' && item.confidence != null ? (item.confidence * 100).toFixed(0) + '%' : ''
      const mit = typeof item === 'object' ? item.mitigation ?? '' : ''
      rows.push([section, String(i + 1), sev, dir, conf, desc, mit])
    })
  }

  if (data.summary) {
    rows.push(['Summary', '', '', '', '', data.summary, ''])
  }
  if (Array.isArray(data.anomalies)) addItems('Anomaly', data.anomalies)
  if (Array.isArray(data.trends)) addItems('Trend', data.trends)
  if (Array.isArray(data.opportunities)) addItems('Opportunity', data.opportunities)
  if (Array.isArray(data.risks)) addItems('Risk', data.risks)

  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildHistoryCSV(entries: any[]): string {
  const rows: string[][] = []
  rows.push(['Date', 'Type', 'Summary'])
  entries.forEach((e) => {
    const date = e.generated_at ?? e.date ?? ''
    const type = e.type ?? e.report_type ?? ''
    const summary = e.summary ?? ''
    rows.push([date, type, summary])
  })
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function AIReports() {
  const [activeTab, setActiveTab] = useState<Tab>('daily')

  const daily = useAIQuery(() => aiInsightsApi.daily(), [])
  const weekly = useAIQuery(() => aiInsightsApi.weekly(), [])
  const history = useAIQuery(() => aiInsightsApi.history({ limit: 20 }), [])

  const dailyData = daily.data?.data ?? daily.data
  const weeklyData = weekly.data?.data ?? weekly.data
  const historyEntries = useMemo(() => {
    const raw = history.data?.data ?? history.data
    if (Array.isArray(raw)) return raw
    if (raw && Array.isArray((raw as any).entries)) return (raw as any).entries
    return []
  }, [history.data])

  const handleDownloadText = useCallback((data: any, type: 'daily' | 'weekly') => {
    if (!data) {
      toast.error('No report data to download')
      return
    }
    const text = buildTextReport(data, type)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(text, `ai-${type}-report-${date}.txt`, 'text/plain')
    toast.success('Report downloaded')
  }, [])

  const handleDownloadCSV = useCallback((data: any, type: 'daily' | 'weekly') => {
    if (!data) {
      toast.error('No report data to download')
      return
    }
    const csv = buildCSVReport(data, type)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `ai-${type}-report-${date}.csv`, 'text/csv')
    toast.success('CSV downloaded')
  }, [])

  const handleDownloadHistoryCSV = useCallback(() => {
    if (historyEntries.length === 0) {
      toast.error('No history data to export')
      return
    }
    const csv = buildHistoryCSV(historyEntries)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `ai-report-history-${date}.csv`, 'text/csv')
    toast.success('History exported')
  }, [historyEntries])

  const currentLoading =
    activeTab === 'daily' ? daily.loading && !daily.data :
    activeTab === 'weekly' ? weekly.loading && !weekly.data :
    history.loading && !history.data

  const currentError =
    activeTab === 'daily' ? (daily.error && !daily.data ? daily.error : null) :
    activeTab === 'weekly' ? (weekly.error && !weekly.data ? weekly.error : null) :
    (history.error && !history.data ? history.error : null)

  const currentRefetch =
    activeTab === 'daily' ? daily.refetch :
    activeTab === 'weekly' ? weekly.refetch :
    history.refetch

  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="AI Reports"
        subtitle="Generate, review, and export AI-powered reports"
      />

      {/* Tab selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <AITabButton active={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>
          Daily Report
        </AITabButton>
        <AITabButton active={activeTab === 'weekly'} onClick={() => setActiveTab('weekly')}>
          Weekly Report
        </AITabButton>
        <AITabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          Report History
        </AITabButton>
      </div>

      {/* Error state */}
      {currentError && (
        <AIErrorState message={currentError} onRetry={currentRefetch} />
      )}

      {/* Loading state */}
      {currentLoading && !currentError && <AILoadingGrid count={4} />}

      {/* Daily Report */}
      {activeTab === 'daily' && !currentLoading && !currentError && (
        <DailyWeeklyReport
          data={dailyData}
          type="daily"
          onDownloadText={() => handleDownloadText(dailyData, 'daily')}
          onDownloadCSV={() => handleDownloadCSV(dailyData, 'daily')}
        />
      )}

      {/* Weekly Report */}
      {activeTab === 'weekly' && !currentLoading && !currentError && (
        <DailyWeeklyReport
          data={weeklyData}
          type="weekly"
          onDownloadText={() => handleDownloadText(weeklyData, 'weekly')}
          onDownloadCSV={() => handleDownloadCSV(weeklyData, 'weekly')}
        />
      )}

      {/* History */}
      {activeTab === 'history' && !currentLoading && !currentError && (
        <HistoryTab entries={historyEntries} onExportCSV={handleDownloadHistoryCSV} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Daily / Weekly Report subcomponent
// ────────────────────────────────────────────────────────────────

function DailyWeeklyReport({
  data,
  type,
  onDownloadText,
  onDownloadCSV,
}: {
  data: any
  type: 'daily' | 'weekly'
  onDownloadText: () => void
  onDownloadCSV: () => void
}) {
  if (!data) {
    return (
      <AIEmptyState
        icon={DocumentTextIcon}
        title={`No ${type} report available`}
        description={`The ${type} report has not been generated yet. Check back later.`}
      />
    )
  }

  const anomalies: any[] = Array.isArray(data.anomalies) ? data.anomalies : []
  const trends: any[] = Array.isArray(data.trends) ? data.trends : []
  const opportunities: any[] = Array.isArray(data.opportunities) ? data.opportunities : []
  const risks: any[] = Array.isArray(data.risks) ? data.risks : []

  return (
    <div className="space-y-6">
      {/* Header with date range and export buttons */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDaysIcon className="w-5 h-5 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                {type === 'daily' ? 'Daily Report' : 'Weekly Report'}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              {type === 'weekly' && data.week_start && data.week_end
                ? `${formatReportDate(data.week_start)} - ${formatReportDate(data.week_end)}`
                : `Generated: ${formatReportDate(data.generated_at)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownloadText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              PDF (Text)
            </button>
            <button
              onClick={onDownloadCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <AIChartCard title="Summary" subtitle="AI-generated overview">
          <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
          {data.counts && (
            <div className="flex flex-wrap gap-3 mt-4">
              {Object.entries(data.counts).map(([key, val]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg"
                >
                  {key.replace(/_/g, ' ')}: {String(val)}
                </span>
              ))}
            </div>
          )}
        </AIChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomalies */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Anomalies
              {anomalies.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">({anomalies.length})</span>
              )}
            </h3>
          </div>
          {anomalies.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No anomalies detected</p>
          ) : (
            <ul className="space-y-2">
              {anomalies.map((a, i) => {
                const desc = typeof a === 'string' ? a : a.description ?? a.title ?? JSON.stringify(a)
                const sev = typeof a === 'object' ? a.severity ?? 'low' : 'low'
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2.5"
                  >
                    <AIBadge label={sev} variant={severityVariant[sev] ?? 'gray'} />
                    <span className="flex-1">{desc}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Trends */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Trends
              {trends.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">({trends.length})</span>
              )}
            </h3>
          </div>
          {trends.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No trends identified</p>
          ) : (
            <ul className="space-y-2">
              {trends.map((t, i) => {
                const desc = typeof t === 'string' ? t : t.description ?? t.title ?? JSON.stringify(t)
                const dir = typeof t === 'object' ? t.direction ?? '' : ''
                const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '↔'
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        'text-base font-bold flex-shrink-0',
                        dir === 'up' ? 'text-emerald-600' : dir === 'down' ? 'text-red-500' : 'text-slate-400',
                      )}
                    >
                      {arrow}
                    </span>
                    <span className="flex-1">{desc}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Opportunities */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <LightBulbIcon className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Opportunities
              {opportunities.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">({opportunities.length})</span>
              )}
            </h3>
          </div>
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No opportunities found</p>
          ) : (
            <ul className="space-y-2">
              {opportunities.map((o, i) => {
                const desc = typeof o === 'string' ? o : o.title ?? o.description ?? JSON.stringify(o)
                const conf = typeof o === 'object' && o.confidence != null
                  ? (o.confidence > 1 ? o.confidence : o.confidence * 100)
                  : null
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-700 bg-emerald-50/60 rounded-xl px-3 py-2.5"
                  >
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="flex-1">{desc}</span>
                    {conf !== null && (
                      <span className="text-xs font-medium text-emerald-600 whitespace-nowrap">
                        {conf.toFixed(0)}%
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Risks */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldExclamationIcon className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Risks
              {risks.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">({risks.length})</span>
              )}
            </h3>
          </div>
          {risks.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No risks identified</p>
          ) : (
            <ul className="space-y-2">
              {risks.map((r, i) => {
                const desc = typeof r === 'string' ? r : r.description ?? r.title ?? JSON.stringify(r)
                const sev = typeof r === 'object' ? r.severity ?? 'low' : 'low'
                const mitigation = typeof r === 'object' ? r.mitigation : null
                return (
                  <li
                    key={i}
                    className="text-sm text-slate-700 bg-red-50/60 rounded-xl px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <AIBadge label={sev} variant={severityVariant[sev] ?? 'gray'} />
                      <span className="flex-1">{desc}</span>
                    </div>
                    {mitigation && (
                      <p className="mt-1.5 ml-[52px] text-xs text-slate-500 italic">
                        Mitigation: {mitigation}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// History Tab subcomponent
// ────────────────────────────────────────────────────────────────

function HistoryTab({
  entries,
  onExportCSV,
}: {
  entries: any[]
  onExportCSV: () => void
}) {
  if (entries.length === 0) {
    return (
      <AIEmptyState
        icon={ClockIcon}
        title="No report history"
        description="Past reports will appear here once they have been generated."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Report History
          <span className="ml-1.5 text-xs font-normal text-slate-400">({entries.length})</span>
        </h3>
        <button
          onClick={onExportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const date = entry.generated_at ?? entry.date ?? ''
                const type = entry.type ?? entry.report_type ?? 'report'
                const summary = entry.summary ?? '--'
                return (
                  <tr
                    key={i}
                    className={cn(
                      'border-b border-slate-50 hover:bg-slate-50/50 transition-colors',
                      i === entries.length - 1 && 'border-b-0',
                    )}
                  >
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {date ? formatReportDate(date) : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <AIBadge
                        label={type}
                        variant={type === 'daily' ? 'blue' : type === 'weekly' ? 'purple' : 'gray'}
                      />
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md truncate">
                      {summary}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
