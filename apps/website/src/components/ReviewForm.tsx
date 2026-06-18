'use client';

import { useState } from 'react';
import { getCustomerToken, submitReview } from '@/lib/client';

/**
 * Inline review submission. Requires a logged-in customer (OTP). If not logged
 * in, points the user to checkout/login. Keeps the form minimal: rating + text.
 */
export function ReviewForm({ slug, restaurantName }: { slug: string; restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = typeof window !== 'undefined' && !!getCustomerToken();

  async function submit() {
    setBusy(true); setError(null);
    try {
      await submitReview(slug, { rating, title: title || undefined, body: body || undefined });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Thanks for reviewing {restaurantName}! Your review will appear once published.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full px-5 py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        Write a review
      </button>
    );
  }

  if (!loggedIn) {
    return (
      <div className="rounded-xl border p-4 text-sm">
        Please <a href="/checkout" className="underline">log in</a> (via your phone number) to leave a review.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="text-2xl"
            style={{ color: n <= rating ? 'var(--brand-secondary)' : '#d1d5db' }}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience…"
        rows={3}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {busy ? 'Submitting…' : 'Submit review'}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm underline">Cancel</button>
      </div>
    </div>
  );
}
