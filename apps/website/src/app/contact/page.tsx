import type { Metadata } from 'next';
import { requireSite } from '@/lib/page';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await requireSite();
  return {
    title: `Contact — ${config.restaurant.name}`,
    description: `Get in touch with ${config.restaurant.name}.`,
  };
}

export default async function ContactPage() {
  const { config } = await requireSite();
  const r = config.restaurant;
  const socials = r.social_links || {};

  // Build a maps embed from explicit embed URL, else coordinates.
  const mapSrc =
    r.map_embed_url ||
    (r.latitude != null && r.longitude != null
      ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}&output=embed`
      : null);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        Contact
      </h1>

      <div className="grid gap-10 sm:grid-cols-2">
        <div>
          <ul className="space-y-3 opacity-80">
            {r.address ? <li>{r.address}</li> : null}
            {r.phone ? (
              <li>
                Phone: <a href={`tel:${r.phone}`} className="underline">{r.phone}</a>
              </li>
            ) : null}
            {r.whatsapp ? (
              <li>
                WhatsApp:{' '}
                <a
                  href={`https://wa.me/${r.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {r.whatsapp}
                </a>
              </li>
            ) : null}
            {r.email ? (
              <li>
                Email: <a href={`mailto:${r.email}`} className="underline">{r.email}</a>
              </li>
            ) : null}
          </ul>

          {Object.keys(socials).length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {Object.entries(socials).map(([name, url]) => (
                <a
                  key={name}
                  href={url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border px-4 py-1.5 text-sm capitalize"
                >
                  {name}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {mapSrc ? (
          <div className="overflow-hidden rounded-xl border">
            <iframe
              title={`${r.name} location`}
              src={mapSrc}
              className="h-64 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
