import type { Metadata } from 'next';
import { currentSlug } from '@/lib/request';
import { fetchSiteConfig } from '@/lib/api';
import './globals.css';

/**
 * Per-tenant SEO. Each restaurant's site gets its own title/description and
 * Open Graph tags so it ranks and previews correctly on Google/WhatsApp.
 */
export async function generateMetadata(): Promise<Metadata> {
  const slug = currentSlug();
  const config = slug ? await fetchSiteConfig(slug) : null;
  const r = config?.restaurant;

  if (!r) {
    return { title: 'AuraOS Restaurants', description: 'Powered by AuraOS' };
  }

  const title = r.tagline ? `${r.name} — ${r.tagline}` : r.name;
  const description = r.description || `Order online from ${r.name}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: r.hero_image_url ? [{ url: r.hero_image_url }] : undefined,
    },
    icons: r.logo_url ? { icon: r.logo_url } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = currentSlug();
  const config = slug ? await fetchSiteConfig(slug) : null;
  const theme = config?.theme;

  // Inject the tenant theme as CSS variables so the whole tree is themed.
  const themeVars = theme
    ? ({
        ['--brand-primary' as string]: theme.primary_color,
        ['--brand-secondary' as string]: theme.secondary_color,
        ['--brand-accent' as string]: theme.accent_color,
        backgroundColor: theme.background_color,
        color: theme.text_color,
        fontFamily: theme.font_family,
      } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en">
      <body style={themeVars}>{children}</body>
    </html>
  );
}
