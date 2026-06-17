/**
 * Host -> tenant resolution middleware.
 *
 * Resolves the current restaurant (tenant) from the incoming Host header so the
 * public website can serve the right tenant from one codebase:
 *
 *   pizza.auraos.com      -> subdomain "pizza"      -> restaurants.slug = 'pizza'
 *   loca.com              -> custom domain           -> custom_domains.domain
 *   localhost / 127.0.0.1 -> DEV_TENANT_SLUG (dev only)
 *
 * Resolution order: custom domain (exact) -> platform subdomain -> dev fallback.
 *
 * The host->tenant mapping is cached in Redis (PostgreSQL stays source of truth).
 * Lookups run via the privileged pool (NOT withTenant) because the tenant is not
 * yet known — this is the one place that legitimately queries across tenants, and
 * it only reads id/slug, never tenant data.
 *
 * On success: attaches req.tenant = { restaurantId, slug }. On unknown host it
 * does NOT throw — it leaves req.tenant undefined so routes can choose to 404 or
 * fall through. Use requireTenant for routes that must have one.
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { cacheGet, cacheSet } from '@/config/redis';
import { env } from '@/config/env';
import { NotFoundError } from '@/shared/errors/AppError';

export interface TenantContext {
  restaurantId: string;
  slug: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

const CACHE_TTL_SECONDS = 300; // 5 min; invalidated on branding/domain updates
const NEGATIVE_TTL_SECONDS = 30; // cache "unknown host" briefly to blunt abuse

function cacheKey(host: string): string {
  return `tenant:host:${host}`;
}

/** Strip port and lowercase. "Pizza.AuraOS.com:443" -> "pizza.auraos.com" */
function normalizeHost(rawHost: string | undefined): string {
  if (!rawHost) return '';
  return rawHost.split(':')[0].trim().toLowerCase();
}

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost')
  );
}

/**
 * Extract the subdomain label if host is `<label>.<PLATFORM_DOMAIN>`.
 * Returns null for the apex domain, www, or non-platform hosts.
 */
function subdomainLabel(host: string): string | null {
  const platform = env.PLATFORM_DOMAIN.toLowerCase();
  if (!host.endsWith(`.${platform}`)) return null;
  const label = host.slice(0, host.length - platform.length - 1);
  if (!label || label === 'www' || label.includes('.')) return null;
  return label;
}

async function lookupBySlug(slug: string): Promise<TenantContext | null> {
  const result = await query(
    `SELECT id, slug FROM restaurants WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const row = result.rows[0];
  return row ? { restaurantId: row.id, slug: row.slug } : null;
}

async function lookupByCustomDomain(host: string): Promise<TenantContext | null> {
  const result = await query(
    `SELECT r.id, r.slug
     FROM custom_domains cd
     JOIN restaurants r ON r.id = cd.restaurant_id
     WHERE cd.domain = $1 AND cd.is_verified = TRUE
     LIMIT 1`,
    [host],
  );
  const row = result.rows[0];
  return row ? { restaurantId: row.id, slug: row.slug } : null;
}

async function resolveTenant(host: string): Promise<TenantContext | null> {
  // 1. Redis cache (positive or negative)
  const cached = await cacheGet(cacheKey(host));
  if (cached !== null) {
    if (cached === '') return null; // negative cache hit
    try {
      return JSON.parse(cached) as TenantContext;
    } catch {
      /* fall through to fresh lookup */
    }
  }

  let tenant: TenantContext | null = null;

  // 2. localhost development fallback
  if (isLocalHost(host)) {
    if (env.DEV_TENANT_SLUG) tenant = await lookupBySlug(env.DEV_TENANT_SLUG);
  } else {
    // 3. platform subdomain
    const label = subdomainLabel(host);
    if (label) {
      tenant = await lookupBySlug(label);
    }
    // 4. custom domain
    if (!tenant) {
      tenant = await lookupByCustomDomain(host);
    }
  }

  // 5. write-through cache (negative cache on miss)
  await cacheSet(
    cacheKey(host),
    tenant ? JSON.stringify(tenant) : '',
    tenant ? CACHE_TTL_SECONDS : NEGATIVE_TTL_SECONDS,
  );

  return tenant;
}

/** Non-throwing: populates req.tenant when resolvable, otherwise leaves it unset. */
export async function resolveTenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const host = normalizeHost(req.headers.host);
    if (host) {
      const tenant = await resolveTenant(host);
      if (tenant) req.tenant = tenant;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Strict guard: 404s when no tenant could be resolved for the host. */
export function requireTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant) {
    next(new NotFoundError('No restaurant is configured for this address'));
    return;
  }
  next();
}
