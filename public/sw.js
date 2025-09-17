
const CACHE_NAME = 'bizsuite-cache-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Add other critical assets like fonts, icons, etc.
  // Note: Next.js assets are often dynamically named, so caching them
  // directly here can be tricky. The fetch handler is more robust.
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: App shell cached successfully');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated and old caches cleared');
      // Inform clients that the new service worker is active.
      self.clients.claim().then(() => {
          self.clients.matchAll().then(clients => {
              clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }));
          });
      });
    })
  );
});


self.addEventListener('fetch', event => {
    const { request } = event;

    // For navigation requests, use a Stale-While-Revalidate strategy.
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                // Get from cache first
                return cache.match(request).then(cachedResponse => {
                    // Fetch from network in the background to update cache
                    const fetchPromise = fetch(request).then(networkResponse => {
                        // Check if we received a valid response
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // Network fetch failed, do nothing, rely on cache.
                    });

                    // Return cached response if available, otherwise wait for network
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // For other requests (API, images, scripts), use Network First, then Cache.
    event.respondWith(
        fetch(request)
            .then(networkResponse => {
                // If the fetch is successful, clone it and cache it.
                if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If the network fetch fails, try to get it from the cache.
                return caches.match(request);
            })
    );
});


self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync event triggered.');
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        if (clients && clients.length) {
          clients.forEach((client) => {
            client.postMessage({ type: 'SYNC_DATA' });
          });
        }
      })
    );
  }
});
