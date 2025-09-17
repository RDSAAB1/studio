
const CACHE_NAME = 'bizsuite-dataflow-cache-v3';
const PRECACHE_ASSETS = [
  '/',
  // Next.js build manifest files
  '/_next/static/css/app/layout.css',
  // You would add more specific build output files here
  // However, for a dynamic approach, we'll cache on the fly.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching App Shell');
      // Precaching a minimal set of assets. More will be cached on the fly.
      return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(error => {
      console.error('[Service Worker] Pre-caching failed:', error);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});


self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests (loading pages), use a network-first strategy
  // to ensure users get the latest HTML, then fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        // If the fetch is successful, cache the new response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
        return response;
      }).catch(() => {
        // If the network fails, serve the page from the cache
        return caches.match(request).then(cachedResponse => {
            return cachedResponse || caches.match('/');
        });
      })
    );
    return;
  }

  // For other requests (CSS, JS, images), use a Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });

      // Return cached response immediately if available, while revalidating in the background
      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('[Service Worker] Background sync triggered.');
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
