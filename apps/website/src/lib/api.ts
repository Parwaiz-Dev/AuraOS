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

// ── Gallery ───────────────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
  category: 'food' | 'interior' | 'event';
  sort_order: number;
}

export async function fetchGallery(slug: string): Promise<GalleryImage[]> {
  try {
    const res = await fetch(`${CORE_API_URL}/public/site/${encodeURIComponent(slug)}/gallery`, {
      next: { revalidate: 300, tags: [`site:${slug}`] },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data as GalleryImage[]) || [];
  } catch (err) {
    console.error('[website] fetchGallery failed:', err);
    return [];
  }
}

// ── Editable page content (Website Builder sections) ───────────────────────────

export interface PageContent {
  page_key: string;
  content: Record<string, unknown>;
  is_published: boolean;
}

export async function fetchPage(slug: string, key: string): Promise<PageContent> {
  try {
    const res = await fetch(
      `${CORE_API_URL}/public/site/${encodeURIComponent(slug)}/page/${encodeURIComponent(key)}`,
      { next: { revalidate: 300, tags: [`site:${slug}`] } },
    );
    if (!res.ok) return { page_key: key, content: {}, is_published: false };
    const json = await res.json();
    return json.data as PageContent;
  } catch (err) {
    console.error('[website] fetchPage failed:', err);
    return { page_key: key, content: {}, is_published: false };
  }
}

// ── Menu (reuses existing Core public menu endpoint) ───────────────────────────

export interface MenuModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  selection_type: string;
  min_select: number;
  max_select: number;
  options: MenuModifierOption[];
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  is_vegetarian?: boolean;
  image_url?: string | null;
  modifier_groups: MenuModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Menu {
  restaurant: { id: string; name: string; slug: string; qr_mode: string };
  categories: MenuCategory[];
  items: MenuItem[];
}

export async function fetchMenu(slug: string): Promise<Menu | null> {
  try {
    const res = await fetch(`${CORE_API_URL}/public/menu/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120, tags: [`site:${slug}`] },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Core API ${res.status}`);
    const json = await res.json();
    return json.data as Menu;
  } catch (err) {
    console.error('[website] fetchMenu failed:', err);
    return null;
  }
}
