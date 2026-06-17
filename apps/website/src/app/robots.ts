import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default function robots(): MetadataRoute.Robots {
  const h = headers();
  const host = h.get('x-tenant-host') || h.get('host') || 'localhost';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${proto}://${host}/sitemap.xml`,
  };
}
