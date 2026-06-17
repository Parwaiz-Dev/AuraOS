import { NextResponse } from 'next/server';
import { currentSlug } from '@/lib/request';
import { fetchSiteConfig } from '@/lib/api';

/**
 * Per-tenant PWA manifest. Because it's host-resolved, each restaurant gets an
 * installable app with its own name, theme color and icon — "install loca.com
 * as an app" works without an app store.
 */
export async function GET() {
  const slug = currentSlug();
  const config = slug ? await fetchSiteConfig(slug) : null;
  const r = config?.restaurant;
  const theme = config?.theme;

  const icon = r?.logo_url
    ? [{ src: r.logo_url, sizes: '512x512', type: 'image/png', purpose: 'any' as const }]
    : [];

  const manifest = {
    name: r?.name || 'AuraOS Restaurant',
    short_name: r?.name?.slice(0, 12) || 'AuraOS',
    description: r?.tagline || r?.description || 'Order online',
    start_url: '/',
    display: 'standalone',
    background_color: theme?.background_color || '#ffffff',
    theme_color: theme?.primary_color || '#111827',
    icons: icon,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
