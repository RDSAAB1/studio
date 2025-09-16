// sw.js

const CACHE_NAME = 'bizsuite-dataflow-v1';

// Install event: cache the app shell
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // No need to pre-cache everything. We will cache on-the-fly.
  event.waitUntil(self.skipWaiting());
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network falling back to cache
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For navigation requests, use a network-first strategy to ensure users get the latest HTML.
  if (event.request.mode === 'navigate') {
     event.respondWith(
        fetch(event.request).catch(() => caches.match('/_offline.html')) // A fallback offline page would be ideal here. For now, it will fail gracefully.
     );
     return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we get a valid response, we clone it and cache it.
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network request fails (e.g., user is offline),
        // try to serve the response from the cache.
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the request is not in the cache, we can't do anything.
          // This will result in a standard browser network error.
          // A better approach would be to return a placeholder for images/pages.
          console.warn('Fetch failed from both network and cache:', event.request.url);
          // Return a synthetic error response so the promise doesn't fail uncaught
          return new Response(JSON.stringify({ error: "Offline and not in cache" }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});


// Sync event for background data synchronization
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered.');
    // Here you would typically import and call your syncData function.
    // Since we cannot directly import client-side modules,
    // we notify the client to perform the sync.
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_DATA' });
        });
      })
    );
  }
});

// Periodic Sync event
self.addEventListener('periodicsync', (event) => {
    if (event.tag.startsWith('periodic-sync')) {
        console.log('Service Worker: Periodic sync triggered.');
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});
