import { notFound } from 'next/navigation';
import { currentSlug } from '@/lib/request';
import { fetchSiteConfig } from '@/lib/api';

export const revalidate = 300; // ISR: regenerate at most every 5 minutes

/**
 * Tenant home page (Phase 0b foundation slice).
 *
 * Proves the full chain end-to-end: Host -> middleware slug -> Core API ->
 * themed render. Hero, featured dishes, testimonials and the rest of the
 * Website Builder sections land in Phase 1.
 */
export default async function HomePage() {
  const slug = currentSlug();
  if (!slug) {
    // No tenant for this host (e.g. apex/marketing domain). Phase 1 adds a
    // platform landing page; for now this is a clear, intentional 404.
    notFound();
  }

  const config = await fetchSiteConfig(slug);
  if (!config) notFound();

  const { restaurant, opening_hours } = config;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <main className="min-h-screen">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
      >
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logo_url} alt={restaurant.name} className="mb-6 h-20 w-20 rounded-full object-cover" />
        ) : null}
        <h1 className="text-4xl font-bold sm:text-5xl">{restaurant.name}</h1>
        {restaurant.tagline ? (
          <p className="mt-3 max-w-xl text-lg opacity-90">{restaurant.tagline}</p>
        ) : null}
        {restaurant.phone ? (
          <a
            href={`tel:${restaurant.phone}`}
            className="mt-8 rounded-full px-6 py-3 font-semibold"
            style={{ backgroundColor: 'var(--brand-secondary)', color: '#111' }}
          >
            Call to Order
          </a>
        ) : null}
      </section>

      {/* ── About ──────────────────────────────────────────────────────── */}
      {restaurant.description ? (
        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="mb-4 text-2xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            About Us
          </h2>
          <p className="leading-relaxed opacity-80">{restaurant.description}</p>
        </section>
      ) : null}

      {/* ── Contact + Hours ────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-4xl gap-10 px-6 pb-20 sm:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Contact
          </h2>
          <ul className="space-y-2 opacity-80">
            {restaurant.address ? <li>{restaurant.address}</li> : null}
            {restaurant.phone ? <li>Phone: {restaurant.phone}</li> : null}
            {restaurant.whatsapp ? <li>WhatsApp: {restaurant.whatsapp}</li> : null}
            {restaurant.email ? <li>Email: {restaurant.email}</li> : null}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Opening Hours
          </h2>
          {opening_hours.length === 0 ? (
            <p className="opacity-60">Hours not set yet.</p>
          ) : (
            <ul className="space-y-1 opacity-80">
              {opening_hours.map((h) => (
                <li key={h.day_of_week} className="flex justify-between">
                  <span>{days[h.day_of_week]}</span>
                  <span>
                    {h.is_closed || !h.open_time ? 'Closed' : `${h.open_time} – ${h.close_time}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="py-8 text-center text-sm opacity-50">
        {restaurant.name} · Powered by AuraOS
      </footer>
    </main>
  );
}
