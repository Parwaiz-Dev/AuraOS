'use client';

import { createContext, useContext } from 'react';
import { CartProvider } from '@/lib/cart';

const SlugContext = createContext<string>('');

/** Read the current tenant slug inside client components. */
export function useTenantSlug(): string {
  return useContext(SlugContext);
}

/** Client-side providers wrapper (tenant slug + cart state). */
export function Providers({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <SlugContext.Provider value={slug}>
      <CartProvider>{children}</CartProvider>
    </SlugContext.Provider>
  );
}
