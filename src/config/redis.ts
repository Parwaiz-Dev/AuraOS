/**
 * Redis client wrapper with graceful degradation.
 *
 * Redis is OPTIONAL. If `ioredis` is not installed or REDIS_URL is unset/unreachable,
 * every helper here degrades to a no-op (cache misses, no rate-limit state) and the
 * caller falls back to its source of truth (PostgreSQL). The app never crashes for
 * lack of Redis — it just loses caching/scale features until Redis is wired up.
 *
 * To activate: `npm install ioredis` and set REDIS_URL=redis://redis:6379
 *
 * Used for:
 *   - host -> restaurant tenant-config cache (PostgreSQL remains source of truth)
 *   - OTP storage (TTL keys) for customer phone login (Phase 2)
 *   - distributed rate limiting (Phase 2+)
 *   - Socket.io adapter for multi-instance scaling (wired in server.ts when present)
 */

type MinimalRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
  on(event: string, cb: (...args: any[]) => void): void;
};

let client: MinimalRedis | null = null;
let initialized = false;
let available = false;

function init(): void {
  if (initialized) return;
  initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('ℹ️  REDIS_URL not set — Redis features disabled (PostgreSQL fallback active)');
    return;
  }

  try {
    // Lazy require so the backend compiles/runs without ioredis installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    });
    client!.on('ready', () => {
      available = true;
      console.log('✅ Redis connected');
    });
    client!.on('error', (err: Error) => {
      available = false;
      // Avoid log spam — only note the first failure class
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️  Redis error (falling back to PostgreSQL):', err.message);
      }
    });
    client!.on('end', () => { available = false; });
  } catch {
    console.log('ℹ️  ioredis not installed — Redis features disabled (PostgreSQL fallback active)');
    client = null;
  }
}

export function isRedisAvailable(): boolean {
  init();
  return available && client !== null;
}

/** Get the raw client, or null if Redis is unavailable. */
export function getRedis(): MinimalRedis | null {
  init();
  return available ? client : null;
}

/** Cache get — returns null on miss or when Redis is down. */
export async function cacheGet(key: string): Promise<string | null> {
  const c = getRedis();
  if (!c) return null;
  try {
    return await c.get(key);
  } catch {
    return null;
  }
}

/** Cache set with TTL (seconds). Silently no-ops when Redis is down. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const c = getRedis();
  if (!c) return;
  try {
    await c.set(key, value, 'EX', ttlSeconds);
  } catch {
    /* ignore — cache is best-effort */
  }
}

/** Delete a cache key (e.g. on tenant config update). No-op when Redis is down. */
export async function cacheDel(key: string): Promise<void> {
  const c = getRedis();
  if (!c) return;
  try {
    await c.del(key);
  } catch {
    /* ignore */
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    try { await client.quit(); } catch { /* ignore */ }
  }
}
