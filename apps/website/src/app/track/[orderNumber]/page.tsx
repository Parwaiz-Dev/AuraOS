import { OrderTracker } from '@/components/OrderTracker';

export const dynamic = 'force-dynamic';

export default function TrackPage({ params }: { params: { orderNumber: string } }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        Track Your Order
      </h1>
      <OrderTracker orderNumber={decodeURIComponent(params.orderNumber)} />
    </main>
  );
}
