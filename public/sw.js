// public/sw.js

const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  // Add other important assets you want to cache initially
  // Be careful not to cache everything, especially large files or API routes
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tell the active service worker to take control of the page immediately.
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    // For navigation requests, use a network-first strategy.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/'))
        );
        return;
    }

    // For other assets, use a cache-first, then network strategy.
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }

            try {
                const networkResponse = await fetch(event.request);
                // Check if we received a valid response
                if (networkResponse && networkResponse.status === 200) {
                    // IMPORTANT: clone the response. A response is a stream
                    // and because we want the browser to consume the response
                    // as well as the cache consuming the response, we need
                    // to clone it so we have two streams.
                    const responseToCache = networkResponse.clone();
                    cache.put(event.request, responseToCache);
                }
                return networkResponse;
            } catch (error) {
                console.error('[Service Worker] Fetch failed; returning offline page if available.', error);
                // If the network request fails, and there's no cache,
                // you might want to return a specific offline page or a generic error response.
                // For now, we just let the fetch fail.
            }
        })
    );
});


// Listen for the periodic sync event
self.addEventListener('periodicsync', (event) => {
  if (event.tag.startsWith('periodic-sync-')) {
    console.log('[Service Worker] Periodic sync triggered by tag:', event.tag);
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_DATA' });
        });
      })
    );
  }
});
