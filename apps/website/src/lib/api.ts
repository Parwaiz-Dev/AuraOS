import { CORE_API_URL } from './config';

export interface TenantTheme {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
}

export interface OpeningHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface SiteConfig {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    hero_image_url: string | null;
    tagline: string | null;
    description: string | null;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    social_links: Record<string, string>;
    latitude: number | null;
    longitude: number | null;
    map_embed_url: string | null;
    published: boolean;
  };
  theme: TenantTheme;
  opening_hours: OpeningHour[];
  features: Record<string, boolean>;
}

/**
 * Fetch a tenant's website config from Core. Server-side only.
 * Returns null on 404 (unknown slug) so pages can render notFound().
 *
 * ISR: cached and revalidated periodically; owner edits trigger on-demand
 * revalidation in a later phase.
 */
export async function fetchSiteConfig(slug: string): Promise<SiteConfig | null> {
  try {
    const res = await fetch(`${CORE_API_URL}/public/site/${encodeURIComponent(slug)}/config`, {
      next: { revalidate: 300, tags: [`site:${slug}`] },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Core API ${res.status}`);
    const json = await res.json();
    return json.data as SiteConfig;
  } catch (err) {
    console.error('[website] fetchSiteConfig failed:', err);
    return null;
  }
}
