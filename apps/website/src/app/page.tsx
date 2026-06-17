import { notFound } from 'next/navigation';
import { currentSlug } from '@/lib/request';
import { fetchSiteConfig, fetchPage, fetchMenu, type MenuItem } from '@/lib/api';

export const revalidate = 300; // ISR

interface Testimonial { name: string; text: string; rating?: number }
interface Offer { title: string; description?: string }

/**
 * Tenant home page — composed of Website Builder sections.
 *
 * Section content comes from website_pages (page_key='home') JSONB so owners can
 * edit copy without code. Each section falls back gracefully when unset, and
 * featured dishes are pulled live from the existing menu.
 */
export default async function HomePage() {
  const slug = currentSlug();
  if (!slug) notFound();

  const [config, page, menu] = await Promise.all([
    fetchSiteConfig(slug),
    fetchPage(slug, 'home'),
    fetchMenu(slug),
  ]);
  if (!config) notFound();

  const { restaurant } = config;
  const c = page.content as {
    hero_heading?: string;
    hero_subheading?: string;
    cta_label?: string;
    testimonials?: Testimonial[];
    offers?: Offer[];
    featured_item_ids?: string[];
  };

  // Featured dishes: explicit picks if set, else first few active items.
  const activeItems = (menu?.items || []).filter((i) => i.is_active);
  const featured: MenuItem[] = c.featured_item_ids?.length
    ? activeItems.filter((i) => c.featured_item_ids!.includes(i.id))
    : activeItems.slice(0, 6);

  const testimonials = c.testimonials || [];
  const offers = c.offers || [];

  return (
    <main className="flex-1">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center"
        style={
          restaurant.hero_image_url
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(${restaurant.hero_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#fff',
              }
            : { backgroundColor: 'var(--brand-primary)', color: '#fff' }
        }
      >
        <h1 className="text-4xl font-bold sm:text-5xl">
          {c.hero_heading || restaurant.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg opacity-90">
          {c.hero_subheading || restaurant.tagline || ''}
        </p>
        <a
          href="/menu"
          className="mt-8 rounded-full px-7 py-3 font-semibold"
          style={{ backgroundColor: 'var(--brand-secondary)', color: '#111' }}
        >
          {c.cta_label || 'View Menu'}
        </a>
      </section>

      {/* ── Featured dishes ────────────────────────────────────────────── */}
      {featured.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-center text-2xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Featured Dishes
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((item) => (
              <div key={item.id} className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{item.name}</h3>
                  <span className="whitespace-nowrap font-bold" style={{ color: 'var(--brand-accent)' }}>
                    ₹{Number(item.price).toFixed(0)}
                  </span>
                </div>
                {item.description ? (
                  <p className="mt-2 text-sm opacity-70">{item.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Offers ─────────────────────────────────────────────────────── */}
      {offers.length > 0 ? (
        <section className="px-6 py-16" style={{ backgroundColor: 'var(--brand-secondary)' }}>
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-semibold text-gray-900">Offers</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {offers.map((o, i) => (
                <div key={i} className="rounded-xl bg-white/90 p-5">
                  <h3 className="font-bold text-gray-900">{o.title}</h3>
                  {o.description ? <p className="mt-1 text-sm text-gray-700">{o.description}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      {testimonials.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-center text-2xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            What Our Guests Say
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <figure key={i} className="rounded-xl border p-5">
                <blockquote className="text-sm italic opacity-80">“{t.text}”</blockquote>
                <figcaption className="mt-3 text-sm font-semibold">— {t.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Closing CTA ────────────────────────────────────────────────── */}
      <section className="px-6 py-20 text-center" style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}>
        <h2 className="text-2xl font-semibold">Hungry?</h2>
        <p className="mt-2 opacity-80">Browse the full menu and order your favourites.</p>
        <a
          href="/menu"
          className="mt-6 inline-block rounded-full px-7 py-3 font-semibold"
          style={{ backgroundColor: 'var(--brand-secondary)', color: '#111' }}
        >
          See the Menu
        </a>
      </section>
    </main>
  );
}
