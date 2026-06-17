'use client';

import { useEffect } from 'react';

/** Registers the service worker for offline support / installability. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failures are non-fatal */
      });
    }
  }, []);
  return null;
}
