/* AuraOS website service worker — offline shell (Phase 1).
 * Network-first for navigations with a cached fallback, so the site shell and
 * last-seen menu remain available offline. Ordering/payments are not cached.
 */
const CACHE = 'auraos-site-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first, falling back to cache (then a minimal offline message).
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          return new Response('<h1>Offline</h1><p>Reconnect to continue.</p>', {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response('', { status: 504 });
      })
  );
});
