import type { Metadata } from 'next';
import { requireSite } from '@/lib/page';
import { fetchPage } from '@/lib/api';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await requireSite();
  return {
    title: `About — ${config.restaurant.name}`,
    description: config.restaurant.description || `About ${config.restaurant.name}.`,
  };
}

export default async function AboutPage() {
  const { slug, config } = await requireSite();
  const page = await fetchPage(slug, 'about');
  const c = page.content as {
    story?: string;
    chef_name?: string;
    chef_bio?: string;
    facilities?: string[];
  };

  const story = c.story || config.restaurant.description || '';
  const facilities = c.facilities || [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        About {config.restaurant.name}
      </h1>

      {story ? (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Our Story
          </h2>
          <p className="leading-relaxed opacity-80">{story}</p>
        </section>
      ) : null}

      {c.chef_name || c.chef_bio ? (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Our Chef
          </h2>
          {c.chef_name ? <p className="font-medium">{c.chef_name}</p> : null}
          {c.chef_bio ? <p className="mt-1 leading-relaxed opacity-80">{c.chef_bio}</p> : null}
        </section>
      ) : null}

      {facilities.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Facilities
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {facilities.map((f, i) => (
              <li key={i} className="rounded-lg border px-3 py-2 text-sm opacity-80">
                {f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!story && !c.chef_name && facilities.length === 0 ? (
        <p className="opacity-60">More about us coming soon.</p>
      ) : null}
    </main>
  );
}
