/**
 * Health & Metrics routes.
 *
 * These endpoints let you (and uptime monitors / load balancers / Kubernetes)
 * know whether AuraOS is actually healthy — not just whether the process is up.
 *
 * Endpoints:
 *   GET /api/v1/health    — DEEP health check. Pings the DB, reports degraded
 *                           state on recent error spikes. Returns 200 when ok,
 *                           503 when a critical dependency is down. Use this for
 *                           uptime monitoring / load-balancer health probes.
 *
 *   GET /api/v1/health/live  — LIVENESS. Always 200 if the process is running.
 *                              Use for "should I restart the container?" checks.
 *
 *   GET /api/v1/health/ready — READINESS. 200 only when the DB is reachable.
 *                              Use to gate traffic until dependencies are up.
 *
 *   GET /api/v1/metrics   — Process + app metrics (uptime, memory, request and
 *                           error counts). Admin-only — may expose internal info.
 *
 * NOTE: /health stays public (no auth) so external monitors can reach it, but
 * it deliberately returns only coarse status — no sensitive internals.
 */

import { Router, Request, Response } from 'express';
import { pool } from '@/config/database';
import { getMetricsSnapshot, getRecentErrors, recentErrorCount } from './monitoring';
import { successResponse } from '@/shared/utils/responseHandler';
import { authenticate } from '@/shared/middleware/authenticate';
import { superAdmin } from '@/shared/middleware/superAdmin';

const router = Router();

/** Ping the DB with a short timeout. Returns latency in ms, or null on failure. */
async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number | null }> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

// ── Deep health check (public) ──────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  const db = await pingDatabase();
  const errors5m = recentErrorCount();

  // Decide overall status:
  //   - DB down            → unhealthy (503)
  //   - many recent errors → degraded (still 200, but flagged)
  //   - otherwise          → ok
  let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
  if (!db.ok) status = 'unhealthy';
  else if (errors5m >= 10) status = 'degraded';

  const body = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: db.ok ? 'up' : 'down', latency_ms: db.latencyMs },
      recent_errors_5m: errors5m,
    },
    uptime_seconds: Math.floor(process.uptime()),
  };

  // 503 when a critical dependency is down so monitors/LBs react correctly
  res.status(status === 'unhealthy' ? 503 : 200).json(body);
});

// ── Liveness (public) — process is running ──────────────────────────────────
router.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

// ── Readiness (public) — dependencies are reachable ─────────────────────────
router.get('/health/ready', async (_req: Request, res: Response) => {
  const db = await pingDatabase();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ready' : 'not_ready',
    database: db.ok ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

// ── Metrics (platform-only) ─────────────────────────────────────────────────
router.get(
  '/metrics',
  authenticate,
  superAdmin,
  (_req: Request, res: Response) => {
    res.status(200).json(successResponse(getMetricsSnapshot()));
  },
);

// ── Recent errors (platform-only) — quick debugging without server access ───
router.get(
  '/metrics/errors',
  authenticate,
  superAdmin,
  (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    res.status(200).json(successResponse(getRecentErrors(limit)));
  },
);

export default router;
