import type { Metadata } from 'next';
import { requireSite } from '@/lib/page';
import { CORE_API_URL } from '@/lib/config';
import { ReviewForm } from '@/components/ReviewForm';

export const revalidate = 120;

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  customer_name: string | null;
  created_at: string;
}
interface ReviewsResponse {
  reviews: ReviewItem[];
  count: number;
  average: number;
}

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await requireSite();
  return {
    title: `Reviews — ${config.restaurant.name}`,
    description: `Read what guests say about ${config.restaurant.name}.`,
  };
}

async function fetchReviews(slug: string): Promise<ReviewsResponse> {
  try {
    const res = await fetch(`${CORE_API_URL}/public/site/${encodeURIComponent(slug)}/reviews`, {
      next: { revalidate: 120, tags: [`site:${slug}`] },
    });
    if (!res.ok) return { reviews: [], count: 0, average: 0 };
    const json = await res.json();
    return json.data as ReviewsResponse;
  } catch {
    return { reviews: [], count: 0, average: 0 };
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} style={{ color: 'var(--brand-secondary)' }}>
      {'★'.repeat(rating)}
      <span className="opacity-30">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default async function ReviewsPage() {
  const { slug, config } = await requireSite();
  const data = await fetchReviews(slug);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>Reviews</h1>
        {data.count > 0 ? (
          <p className="text-sm opacity-70">
            <span className="text-lg font-bold" style={{ color: 'var(--brand-accent)' }}>
              {data.average.toFixed(1)}
            </span>{' '}
            ★ · {data.count} review{data.count === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      <ReviewForm slug={slug} restaurantName={config.restaurant.name} />

      <div className="mt-10 space-y-5">
        {data.reviews.length === 0 ? (
          <p className="opacity-60">No reviews yet. Be the first to leave one.</p>
        ) : (
          data.reviews.map((r) => (
            <figure key={r.id} className="rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <Stars rating={r.rating} />
                <span className="text-xs opacity-50">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.title ? <p className="mt-2 font-semibold">{r.title}</p> : null}
              {r.body ? <p className="mt-1 text-sm opacity-80">{r.body}</p> : null}
              <figcaption className="mt-3 text-sm opacity-60">— {r.customer_name || 'Guest'}</figcaption>
            </figure>
          ))
        )}
      </div>
    </main>
  );
}
