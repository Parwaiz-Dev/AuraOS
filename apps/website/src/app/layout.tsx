import type { Metadata } from 'next';
import { currentSlug } from '@/lib/request';
import { fetchSiteConfig } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
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

  // LocalBusiness structured data — helps each restaurant appear on Google.
  const jsonLd = config
    ? {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: config.restaurant.name,
        image: config.restaurant.hero_image_url || config.restaurant.logo_url || undefined,
        telephone: config.restaurant.phone || undefined,
        address: config.restaurant.address || undefined,
        email: config.restaurant.email || undefined,
        geo:
          config.restaurant.latitude != null && config.restaurant.longitude != null
            ? {
                '@type': 'GeoCoordinates',
                latitude: config.restaurant.latitude,
                longitude: config.restaurant.longitude,
              }
            : undefined,
        sameAs: Object.values(config.restaurant.social_links || {}),
      }
    : null;

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={theme?.primary_color || '#111827'} />
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}
      </head>
      <body style={themeVars} className="flex min-h-screen flex-col">
        {config ? <SiteHeader config={config} /> : null}
        {children}
        {config ? <SiteFooter config={config} /> : null}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
