
const CACHE_NAME = 'bizsuite-dataflow-cache-v2'; // Bumped cache version
const APP_SHELL_URLS = [
  '/',
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      // Using addAll which fetches and caches. It's atomic.
      return cache.addAll(APP_SHELL_URLS);
    }).catch(error => {
        console.error('Service Worker: App Shell Caching failed', error);
    })
  );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches to ensure users get the latest version
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // This allows the service worker to take control of the page immediately.
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests with our cache-first strategy.
    // Other requests, like POST to /api/sync, should be ignored by the service worker.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                // Return the cached response if it's found.
                // console.log('Service Worker: Serving from cache:', event.request.url);
                return response;
            }

            // If not in cache, fetch it from the network.
            // console.log('Service Worker: Fetching from network:', event.request.url);
            return fetch(event.request).then(networkResponse => {
                // If the fetch is successful, we should cache the new response for next time.
                // We need to clone the response because it's a one-time use stream.
                if (networkResponse && networkResponse.status === 200) {
                   const responseToCache = networkResponse.clone();
                   caches.open(CACHE_NAME).then(cache => {
                       cache.put(event.request, responseToCache);
                   });
                }
                return networkResponse;
            });
        }).catch(error => {
            // This will be triggered if the fetch fails, e.g., if the user is offline
            // and the resource is not in the cache.
            console.error('Service Worker: Fetch failed:', error);
            // You could return a custom offline fallback page here if you wanted.
        })
    );
});


// Background Sync Logic
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync event triggered!');
        event.waitUntil(
            // We need a way to call the syncData function.
            // The service worker cannot directly call functions from the main app script.
            // A common pattern is to send a message to the client(s).
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});

// Periodic Background Sync Logic
self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync event triggered!', event.tag);
    if (event.tag.startsWith('periodic-sync-')) {
        event.waitUntil(
             self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                     clients.forEach(client => {
                        client.postMessage({ type: 'SYNC_DATA' });
                    });
                } else {
                    // If no clients are open, we can't update the UI,
                    // but we could try a direct sync if the sync logic was self-contained here.
                    // For now, we rely on an open client to trigger the sync.
                    console.log("Periodic sync: No clients open to trigger sync.");
                }
            })
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
