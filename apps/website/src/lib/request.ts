import { headers } from 'next/headers';

/** Read the tenant slug resolved by middleware (x-tenant-slug header). */
export function currentSlug(): string | null {
  return headers().get('x-tenant-slug');
}
