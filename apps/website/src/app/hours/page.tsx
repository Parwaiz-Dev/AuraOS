import type { Metadata } from 'next';
import { requireSite } from '@/lib/page';
import { DAY_LABELS } from '@/components/SiteChrome';
import type { OpeningHour } from '@/lib/api';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await requireSite();
  return {
    title: `Opening Hours — ${config.restaurant.name}`,
    description: `Opening hours for ${config.restaurant.name}.`,
  };
}

function isOpenNow(hours: OpeningHour[]): boolean {
  const now = new Date();
  const today = hours.find((h) => h.day_of_week === now.getDay());
  if (!today || today.is_closed || !today.open_time || !today.close_time) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open_time.split(':').map(Number);
  const [ch, cm] = today.close_time.split(':').map(Number);
  const open = oh * 60 + om;
  let close = ch * 60 + cm;
  if (close <= open) close += 24 * 60; // crosses midnight
  return cur >= open && cur < close;
}

function fmt(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

export default async function HoursPage() {
  const { config } = await requireSite();
  const hours = config.opening_hours;
  const open = isOpenNow(hours);
  const todayIdx = new Date().getDay();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
          Opening Hours
        </h1>
        {hours.length > 0 ? (
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: open ? '#16a34a' : '#dc2626' }}
          >
            {open ? 'Open now' : 'Closed now'}
          </span>
        ) : null}
      </div>

      {hours.length === 0 ? (
        <p className="opacity-60">Opening hours not set yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {[...hours]
            .sort((a, b) => a.day_of_week - b.day_of_week)
            .map((h) => (
              <li
                key={h.day_of_week}
                className="flex items-center justify-between px-5 py-3"
                style={h.day_of_week === todayIdx ? { fontWeight: 600 } : undefined}
              >
                <span>{DAY_LABELS[h.day_of_week]}</span>
                <span className="opacity-80">
                  {h.is_closed || !h.open_time ? 'Closed' : `${fmt(h.open_time)} – ${fmt(h.close_time)}`}
                </span>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
