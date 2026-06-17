import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

/**
 * Per-tenant sitemap. Uses the request host so each restaurant's site exposes
 * its own absolute URLs to search engines.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const h = headers();
  const host = h.get('x-tenant-host') || h.get('host') || 'localhost';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  const base = `${proto}://${host}`;

  const routes = ['', '/menu', '/about', '/gallery', '/hours', '/contact'];
  return routes.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
