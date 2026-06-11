/**
 * Monitoring — lightweight, dependency-free observability for AuraOS.
 *
 * WHAT THIS GIVES YOU TODAY (no external service required):
 *   - captureError()      → records unhandled/server errors with context, keeps
 *                           an in-memory ring buffer of the most recent errors
 *                           so /health can surface "recent error count".
 *   - trackRequest()      → counts requests + errors + tracks slow requests.
 *   - getMetricsSnapshot()→ uptime, memory, request/error counts for /metrics.
 *
 * SENTRY-READY (activates automatically when you add it):
 *   This module looks for SENTRY_DSN. If set AND the optional `@sentry/node`
 *   package is installed, errors are forwarded to Sentry as well. If neither is
 *   present, everything still works — errors just go to the console + ring buffer.
 *
 *   To enable Sentry later:
 *     1. npm install @sentry/node
 *     2. Add SENTRY_DSN=https://...  to your .env
 *     3. Restart. No code changes needed.
 *
 * Design note: we intentionally avoid a hard dependency so the platform runs
 * with zero monitoring config in dev, and richer monitoring in production.
 */

import { env } from '@/config/env';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CapturedError {
  message: string;
  stack?: string;
  statusCode?: number;
  path?: string;
  method?: string;
  restaurantId?: string;
  timestamp: string;
}

interface Metrics {
  startedAt: number;
  totalRequests: number;
  totalErrors: number;
  slowRequests: number; // requests slower than SLOW_MS
}

// ── State ──────────────────────────────────────────────────────────────────

const RING_SIZE = 50;          // keep the last N errors in memory
const SLOW_MS = 1000;          // a request slower than this is "slow"
const recentErrors: CapturedError[] = [];

const metrics: Metrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  slowRequests: 0,
};

// ── Optional Sentry (lazy, soft dependency) ─────────────────────────────────

let sentry: any = null;
let sentryReady = false;

/**
 * Try to initialise Sentry if a DSN is configured and the package is installed.
 * Safe to call once at startup; silently no-ops if either is missing.
 */
export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('  ℹ️  Monitoring: console + in-memory (set SENTRY_DSN to enable Sentry)');
    return;
  }
  try {
    // Soft require — only loaded if the package exists.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    sentryReady = true;
    console.log('  ✅ Monitoring: Sentry enabled');
  } catch {
    console.warn('  ⚠️  SENTRY_DSN set but @sentry/node not installed — run: npm install @sentry/node');
  }
}

// ── Error capture ────────────────────────────────────────────────────────────

/**
 * Record an error. Called by the global error handler and any catch block
 * that wants centralised reporting. Adds to the in-memory ring buffer, bumps
 * the error counter, and forwards to Sentry if enabled.
 */
export function captureError(
  error: Error,
  context: {
    statusCode?: number;
    path?: string;
    method?: string;
    restaurantId?: string;
  } = {},
): void {
  metrics.totalErrors++;

  const entry: CapturedError = {
    message: error.message,
    stack: error.stack,
    statusCode: context.statusCode,
    path: context.path,
    method: context.method,
    restaurantId: context.restaurantId,
    timestamp: new Date().toISOString(),
  };

  // Push to ring buffer, trimming oldest beyond RING_SIZE
  recentErrors.push(entry);
  if (recentErrors.length > RING_SIZE) recentErrors.shift();

  // Forward to Sentry if configured
  if (sentryReady && sentry) {
    try {
      sentry.captureException(error, {
        extra: context,
        tags: context.restaurantId ? { restaurantId: context.restaurantId } : undefined,
      });
    } catch {
      /* never let monitoring crash the request */
    }
  }
}

// ── Request tracking ─────────────────────────────────────────────────────────

/** Count a completed request and flag it if slow. */
export function trackRequest(durationMs: number, statusCode: number): void {
  metrics.totalRequests++;
  if (durationMs >= SLOW_MS) metrics.slowRequests++;
  // 5xx already captured via captureError; this keeps the counters consistent
  // even for errors that bypass the error handler.
  if (statusCode >= 500) {
    // no-op here (avoid double counting with captureError)
  }
}

// ── Snapshots (for /health and /metrics) ───────────────────────────────────

/**
 * How many errors happened in the last `windowMs` (default 5 min).
 * Used by /health to flag "degraded" when errors are spiking.
 */
export function recentErrorCount(windowMs = 5 * 60 * 1000): number {
  const cutoff = Date.now() - windowMs;
  return recentErrors.filter((e) => new Date(e.timestamp).getTime() >= cutoff).length;
}

/** Return the most recent N errors (most recent last). For admin debugging. */
export function getRecentErrors(limit = 20): CapturedError[] {
  return recentErrors.slice(-limit);
}

/** Process + app metrics for the /metrics endpoint. */
export function getMetricsSnapshot() {
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor((Date.now() - metrics.startedAt) / 1000);
  return {
    uptime_seconds: uptimeSec,
    memory: {
      rss_mb: +(mem.rss / 1024 / 1024).toFixed(1),
      heap_used_mb: +(mem.heapUsed / 1024 / 1024).toFixed(1),
      heap_total_mb: +(mem.heapTotal / 1024 / 1024).toFixed(1),
    },
    requests: {
      total: metrics.totalRequests,
      errors: metrics.totalErrors,
      slow: metrics.slowRequests,
      error_rate: metrics.totalRequests
        ? +(metrics.totalErrors / metrics.totalRequests).toFixed(4)
        : 0,
    },
    recent_errors_5m: recentErrorCount(),
  };
}
