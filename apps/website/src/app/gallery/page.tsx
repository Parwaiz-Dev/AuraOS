import type { Metadata } from 'next';
import { requireSite } from '@/lib/page';
import { fetchGallery, type GalleryImage } from '@/lib/api';

export const revalidate = 300;

const CATEGORIES: Array<{ key: GalleryImage['category']; label: string }> = [
  { key: 'food', label: 'Food' },
  { key: 'interior', label: 'Interior' },
  { key: 'event', label: 'Events' },
];

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await requireSite();
  return {
    title: `Gallery — ${config.restaurant.name}`,
    description: `Photos from ${config.restaurant.name}.`,
  };
}

export default async function GalleryPage() {
  const { slug, config } = await requireSite();
  const images = await fetchGallery(slug);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        Gallery
      </h1>

      {images.length === 0 ? (
        <p className="opacity-60">Photos coming soon.</p>
      ) : (
        CATEGORIES.map(({ key, label }) => {
          const group = images.filter((img) => img.category === key);
          if (group.length === 0) return null;
          return (
            <section key={key} className="mb-12">
              <h2 className="mb-4 text-xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
                {label}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {group.map((img) => (
                  <figure key={img.id} className="overflow-hidden rounded-xl border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.caption || `${config.restaurant.name} ${label}`}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                    {img.caption ? (
                      <figcaption className="px-3 py-2 text-sm opacity-70">{img.caption}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
