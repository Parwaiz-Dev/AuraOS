'use client';

import { useState } from 'react';
import { useTenantSlug } from '@/components/Providers';
import { createReservation } from '@/lib/client';

export default function BookPage() {
  const slug = useTenantSlug();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [party, setParty] = useState(2);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [requests, setRequests] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { reserved_for: string; party_size: number }>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const reservedFor = new Date(`${date}T${time}`);
      if (isNaN(reservedFor.getTime())) throw new Error('Pick a valid date and time');
      const r = await createReservation(slug, {
        customer_name: name,
        customer_phone: phone,
        party_size: party,
        reserved_for: reservedFor.toISOString(),
        special_requests: requests || undefined,
      });
      setDone({ reserved_for: r.reserved_for, party_size: r.party_size });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>Booking requested!</h1>
        <p className="opacity-80">
          Table for {done.party_size} on {new Date(done.reserved_for).toLocaleString()}.
        </p>
        <p className="mt-2 text-sm opacity-60">The restaurant will confirm your reservation shortly.</p>
        <a href="/" className="mt-6 inline-block underline">Back to home</a>
      </main>
    );
  }

  const valid = name && phone.length >= 8 && date && time && party > 0;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>Book a Table</h1>

      {error ? <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Mobile number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Guests</label>
          <input type="number" min={1} max={100} value={party}
            onChange={(e) => setParty(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Special requests (optional)</label>
          <textarea value={requests} onChange={(e) => setRequests(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <button onClick={submit} disabled={busy || !valid}
          className="w-full rounded-full px-6 py-3 font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}>
          {busy ? 'Requesting…' : 'Request Booking'}
        </button>
      </div>
    </main>
  );
}
