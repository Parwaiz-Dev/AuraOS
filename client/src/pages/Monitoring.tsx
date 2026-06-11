/**
 * Monitoring Dashboard — Platform-only UI for SuperAdmin.
 *
 * Endpoints consumed (all existing, no backend changes):
 *   GET /api/v1/health        — deep health check
 *   GET /api/v1/health/live   — liveness
 *   GET /api/v1/health/ready  — readiness
 *   GET /api/v1/metrics        — uptime, memory, request/error counts
 *   GET /api/v1/metrics/errors — recent errors (ring buffer)
 *
 * Access: SuperAdmin only (email allowlist). Guarded by isSuperAdmin check
 * on the frontend AND superAdmin middleware on the backend.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Loading from '../components/Loading';
import {
  HeartIcon,
  BoltIcon,
  ShieldCheckIcon,
  ClockIcon,
  CpuChipIcon,
  ArrowPathIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────────────

interface HealthCheck {
  status: string;
  checks?: {
    database?: { status: string; latency_ms: number };
    recent_errors_5m?: number;
  };
  uptime_seconds?: number;
  database?: string;
  timestamp?: string;
}

interface MetricsSnapshot {
  uptime_seconds: number;
  memory: { rss_mb: number; heap_used_mb: number; heap_total_mb: number };
  request_count: number;
  error_count: number;
  slow_count: number;
  error_rate: number;
}

interface CapturedError {
  timestamp: string;
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  restaurantId?: string;
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

// ── Status badge helper ──────────────────────────────────────────────────────

function statusBadge(status: string): { label: string; variant: 'success' | 'warning' | 'error' } {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'up') return { label: 'OK', variant: 'success' };
  if (s === 'degraded') return { label: 'Degraded', variant: 'warning' };
  return { label: 'Down', variant: 'error' };
}

// ── Component ────────────────────────────────────────────────────────────────

const Monitoring: React.FC = () => {
  const { user } = useAuth();

  // Guard: super admin only
  if (user && !user.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return <MonitoringContent />;
};

const MonitoringContent: React.FC = () => {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [liveStatus, setLiveStatus] = useState<number | null>(null);
  const [readyStatus, setReadyStatus] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [healthRes, liveRes, readyRes, metricsRes, errorsRes] = await Promise.allSettled([
        api.get('/health'),
        api.get('/health/live'),
        api.get('/health/ready'),
        api.get('/metrics'),
        api.get('/metrics/errors?limit=50'),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value.data.data ?? healthRes.value.data);
      }
      if (liveRes.status === 'fulfilled') {
        setLiveStatus(liveRes.value.status);
      } else {
        setLiveStatus(null);
      }
      if (readyRes.status === 'fulfilled') {
        setReadyStatus(readyRes.value.status);
      } else {
        setReadyStatus(null);
      }
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value.data.data ?? metricsRes.value.data);
      } else if (metricsRes.reason?.response?.status === 403) {
        // superAdmin middleware rejected — user isn't a superadmin
        setError('Access denied. SuperAdmin only.');
      }
      if (errorsRes.status === 'fulfilled') {
        const errData = errorsRes.value.data.data ?? errorsRes.value.data;
        setErrors(Array.isArray(errData) ? errData : []);
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const toggleErrorExpand = (idx: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loading size="lg" text="Fetching monitoring data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            System health, metrics, and recent errors
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          title="Refresh"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Global error banner */}
      {error && (
        <Card className="border-red-200 bg-red-50 !p-4">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {/* ── System Status Cards ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          System Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Health */}
          <Card hover className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <HeartIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Health</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-slate-900">
                  {health?.status ?? '—'}
                </p>
                {health?.status && (
                  <Badge
                    variant={statusBadge(health.status).variant}
                    className="text-xs"
                  >
                    {statusBadge(health.status).label}
                  </Badge>
                )}
              </div>
              {health?.checks?.database?.latency_ms != null && (
                <p className="text-xs text-slate-400">
                  DB: {health.checks.database.latency_ms}ms
                </p>
              )}
            </div>
          </Card>

          {/* Live */}
          <Card hover className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <BoltIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Live</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-slate-900">
                  {liveStatus === 200 ? 'Alive' : liveStatus === null ? '—' : 'Down'}
                </p>
                <Badge
                  variant={liveStatus === 200 ? 'success' : 'error'}
                  className="text-xs"
                >
                  {liveStatus ?? '—'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Ready */}
          <Card hover className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Ready</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-slate-900">
                  {readyStatus === 200 ? 'Ready' : readyStatus === null ? '—' : 'Not Ready'}
                </p>
                <Badge
                  variant={readyStatus === 200 ? 'success' : 'error'}
                  className="text-xs"
                >
                  {readyStatus ?? '—'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Metrics Cards ────────────────────────────────────────────────────── */}
      {metrics && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Uptime */}
            <Card hover className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Uptime</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatUptime(metrics.uptime_seconds)}
                </p>
              </div>
            </Card>

            {/* Memory */}
            <Card hover className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <CpuChipIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Memory (RSS)</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatMemory(metrics.memory.rss_mb)}
                </p>
                <p className="text-xs text-slate-400">
                  Heap: {formatMemory(metrics.memory.heap_used_mb)} / {formatMemory(metrics.memory.heap_total_mb)}
                </p>
              </div>
            </Card>

            {/* Requests */}
            <Card hover className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <ServerStackIcon className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Requests</p>
                <p className="text-lg font-bold text-slate-900">
                  {metrics.request_count.toLocaleString()}
                </p>
                {metrics.slow_count > 0 && (
                  <p className="text-xs text-amber-500">
                    {metrics.slow_count} slow
                  </p>
                )}
              </div>
            </Card>

            {/* Errors */}
            <Card hover className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircleIcon className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Errors</p>
                <p className="text-lg font-bold text-slate-900">
                  {metrics.error_count.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">
                  Rate: {(metrics.error_rate * 100).toFixed(1)}%
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Recent Errors ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Recent Errors
          {errors.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              (last {errors.length})
            </span>
          )}
        </h2>

        {errors.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-8 text-slate-400">
              <ShieldCheckIcon className="h-10 w-10 mb-2 text-emerald-400" />
              <p className="text-sm font-medium">No recent errors</p>
              <p className="text-xs mt-1">The error ring buffer is empty.</p>
            </div>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Timestamp</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err, idx) => (
                    <React.Fragment key={idx}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => toggleErrorExpand(idx)}
                      >
                        <td className="text-center">
                          {err.stack ? (
                            expandedErrors.has(idx) ? (
                              <ChevronDownIcon className="h-4 w-4 text-slate-400 inline" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-slate-400 inline" />
                            )
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                        </td>
                        <td className="text-xs whitespace-nowrap text-slate-500">
                          {formatTimestamp(err.timestamp)}
                        </td>
                        <td>
                          {err.method ? (
                            <Badge variant="default" className="text-xs font-mono">
                              {err.method}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-xs font-mono text-slate-600 max-w-[200px] truncate">
                          {err.path || '—'}
                        </td>
                        <td className="text-sm text-slate-800 max-w-[300px] truncate">
                          {err.message}
                        </td>
                      </tr>
                      {expandedErrors.has(idx) && err.stack && (
                        <tr>
                          <td></td>
                          <td colSpan={4} className="p-0">
                            <div className="bg-slate-900 text-slate-300 p-4 m-2 rounded-lg overflow-x-auto">
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                {err.stack}
                              </pre>
                              {err.restaurantId && (
                                <p className="text-xs text-slate-500 mt-2">
                                  Restaurant: {err.restaurantId}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Monitoring;