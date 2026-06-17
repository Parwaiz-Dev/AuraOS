import { PLATFORM_DOMAIN, DEV_TENANT_SLUG } from './config';

/**
 * Resolve the tenant slug from a Host header — the website-side mirror of the
 * Core resolveTenant middleware. Core remains authoritative (it also handles
 * verified custom domains); this is used for routing and SSR data fetching.
 *
 *   pizza.auraos.com -> "pizza"
 *   localhost:3002   -> DEV_TENANT_SLUG
 *   loca.com         -> null here (custom domains resolve via Core by host)
 */
export function slugFromHost(rawHost: string | undefined | null): string | null {
  if (!rawHost) return null;
  const host = rawHost.split(':')[0].trim().toLowerCase();

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost')
  ) {
    return DEV_TENANT_SLUG || null;
  }

  const platform = PLATFORM_DOMAIN.toLowerCase();
  if (host.endsWith(`.${platform}`)) {
    const label = host.slice(0, host.length - platform.length - 1);
    if (label && label !== 'www' && !label.includes('.')) return label;
  }

  return null;
}
