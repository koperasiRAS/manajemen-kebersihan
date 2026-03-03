// Minimal service worker - network first, no aggressive caching
// This ensures fresh content is always served

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear ALL old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always fetch from network - no caching
  event.respondWith(fetch(event.request));
});
