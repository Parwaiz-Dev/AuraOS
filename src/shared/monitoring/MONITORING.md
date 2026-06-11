# Monitoring & Health

AuraOS ships with built-in, zero-config monitoring that works in development
and scales up to Sentry in production — no code changes needed.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/v1/health` | public | **Deep** check — pings the DB, flags degraded state on error spikes. Returns `503` when the DB is down. Point your uptime monitor / load balancer here. |
| `GET /api/v1/health/live` | public | **Liveness** — `200` whenever the process is running. For "restart the container?" checks. |
| `GET /api/v1/health/ready` | public | **Readiness** — `200` only when the DB is reachable. For gating traffic on startup. |
| `GET /api/v1/metrics` | admin | Uptime, memory, request/error counts, slow-request count, error rate. |
| `GET /api/v1/metrics/errors?limit=20` | admin | The most recent captured errors (message, stack, path, method, restaurant). |

### Example: `/health` response

```json
{
  "status": "ok",                 // ok | degraded | unhealthy
  "checks": {
    "database": { "status": "up", "latency_ms": 1 },
    "recent_errors_5m": 0
  },
  "uptime_seconds": 57
}
```

- `degraded` → DB is up but ≥10 errors occurred in the last 5 minutes.
- `unhealthy` (HTTP 503) → DB ping failed.

## What's captured automatically

- **All 5xx errors** flowing through the global error handler (with request
  path, method, and restaurant context). 4xx client errors are not captured —
  they're expected.
- **Unhandled promise rejections** and **uncaught exceptions** at the process
  level (see `server.ts`). Uncaught exceptions are recorded, then the process
  exits so your process manager can restart it cleanly.

Captured errors are kept in an in-memory ring buffer (last 50) so you can
inspect them via `/api/v1/metrics/errors` without server/log access.

## Enabling Sentry (production)

In-memory monitoring is lost on restart and isn't great across multiple
instances. For production, forward errors to Sentry:

```bash
npm install @sentry/node
```

```bash
# .env
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

Restart the server. You'll see `✅ Monitoring: Sentry enabled` on startup, and
all captured errors will also appear in your Sentry dashboard. If `SENTRY_DSN`
is set but the package isn't installed, the server warns and falls back to
console + in-memory (it never crashes over monitoring).

## Recommended uptime setup

Point an external monitor (UptimeRobot, BetterStack, Pingdom, or your cloud
provider's health probe) at:

```
https://your-domain/api/v1/health
```

Alert when it returns non-200 or stops responding. This catches both process
death and database outages.
