
const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
// This list is intentionally minimal. The service worker will cache other resources
// dynamically as the user navigates the app for the first time.
const APP_SHELL_URLS = [
  '/',
];

// On install, cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
});

// On activation, clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// On fetch, use cache-first strategy
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // If the response is in the cache, return it
        if (response) {
          return response;
        }

        // If it's not in the cache, fetch it from the network
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(() => {
            // **ERROR HANDLING ADDED HERE**
            // If the network request fails (e.g., user is offline),
            // we can return a fallback page or do nothing.
            // For now, we will just log the error.
            console.error('[Service Worker] Fetch failed, and no cache available for:', event.request.url);
            // Optionally, you could return a fallback response:
            // return caches.match('/offline.html');
          });
      })
  );
});


// Listen for the sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[Service Worker] Background sync triggered!');
    // The service worker will attempt to sync data with the server.
    // We notify the client to handle the sync logic.
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_DATA' });
        });
      })
    );
  }
});

// Listen for periodic sync events
self.addEventListener('periodicsync', (event) => {
  const tag = (event as any).tag;
  if (tag.startsWith('periodic-sync-')) {
    console.log(`[Service Worker] Periodic sync triggered for tag: ${tag}`);
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_DATA' });
        });
      })
    );
  }
});

