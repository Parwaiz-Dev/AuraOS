import { NextRequest, NextResponse } from 'next/server';
import { slugFromHost } from '@/lib/tenant';

/**
 * Edge middleware: resolve the tenant slug from the Host header and forward it
 * to server components via the x-tenant-slug header. Custom domains that aren't
 * subdomains are left for Core to resolve by host (passed through as the raw host).
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host');
  const slug = slugFromHost(host);

  const requestHeaders = new Headers(req.headers);
  if (slug) requestHeaders.set('x-tenant-slug', slug);
  if (host) requestHeaders.set('x-tenant-host', host);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
