import { notFound } from 'next/navigation';
import { currentSlug } from '@/lib/request';
import { fetchSiteConfig, type SiteConfig } from '@/lib/api';

/**
 * Shared page guard: resolve slug + config or 404. Every routed page starts here
 * so tenant resolution and the not-found contract live in one place.
 */
export async function requireSite(): Promise<{ slug: string; config: SiteConfig }> {
  const slug = currentSlug();
  if (!slug) notFound();
  const config = await fetchSiteConfig(slug);
  if (!config) notFound();
  return { slug, config };
}
