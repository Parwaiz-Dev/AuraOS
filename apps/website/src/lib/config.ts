/**
 * Browser/runtime config for the website.
 *
 * The website is a thin client over the existing AuraOS Core API — it owns no
 * database and no business logic. CORE_API_URL points at the Express backend.
 */
export const CORE_API_URL =
  process.env.CORE_API_URL || process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:3000/api/v1';

// Socket.io server (Core). Defaults to the API origin without the /api/v1 suffix.
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

// The apex under which tenant subdomains live (mirrors Core's PLATFORM_DOMAIN).
export const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || 'auraos.com';

// On localhost there is no real subdomain, so fall back to this tenant slug in dev.
export const DEV_TENANT_SLUG = process.env.DEV_TENANT_SLUG || '';
