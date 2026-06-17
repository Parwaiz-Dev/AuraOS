import type { Metadata } from 'next';
import { requireSite } from '@/lib/page';
import { fetchMenu } from '@/lib/api';
import { AddToCart } from '@/components/AddToCart';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await requireSite();
  return {
    title: `Menu — ${config.restaurant.name}`,
    description: `Browse the menu at ${config.restaurant.name}.`,
  };
}

export default async function MenuPage() {
  const { slug, config } = await requireSite();
  const menu = await fetchMenu(slug);

  const categories = (menu?.categories || []).filter((c) => c.is_active);
  const items = (menu?.items || []).filter((i) => i.is_active);
  const uncategorized = items.filter((i) => !categories.some((c) => c.id === i.category_id));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        {config.restaurant.name} — Menu
      </h1>

      {items.length === 0 ? (
        <p className="opacity-60">The menu is being prepared. Please check back soon.</p>
      ) : null}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category_id === cat.id);
        if (catItems.length === 0) return null;
        return <MenuSection key={cat.id} title={cat.name} items={catItems} />;
      })}

      {uncategorized.length > 0 ? <MenuSection title="More" items={uncategorized} /> : null}
    </main>
  );
}

function MenuSection({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    is_vegetarian?: boolean;
    modifier_groups: Array<{ id: string }>;
  }>;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b pb-2 text-xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
        {title}
      </h2>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  aria-label={item.is_vegetarian ? 'Vegetarian' : 'Non-vegetarian'}
                  title={item.is_vegetarian ? 'Veg' : 'Non-veg'}
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ backgroundColor: item.is_vegetarian ? '#16a34a' : '#dc2626' }}
                />
                <span className="font-medium">{item.name}</span>
              </div>
              {item.description ? <p className="mt-1 text-sm opacity-70">{item.description}</p> : null}
              {item.modifier_groups.length > 0 ? (
                <p className="mt-1 text-xs opacity-50">Customisable</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="whitespace-nowrap font-semibold" style={{ color: 'var(--brand-accent)' }}>
                ₹{Number(item.price).toFixed(0)}
              </span>
              <AddToCart menuItemId={item.id} name={item.name} price={Number(item.price)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
