// public/sw.js

const CACHE_NAME = 'bizsuite-dataflow-v1.3'; // Incremented version to ensure SW update
const APP_SHELL_URLS = [
    '/',
    // We will let the service worker cache other assets as they are requested.
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching app shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .catch(error => {
                console.error('Failed to cache app shell during install:', error);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Ignore non-GET requests (like POST for syncing)
    if (event.request.method !== 'GET') {
        // Let the browser handle it without interception.
        return;
    }
    
    // Ignore requests for Chrome extensions
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // If the response is in the cache, return it
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If not in cache, fetch from the network
                return fetch(event.request)
                    .then(networkResponse => {
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
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(error => {
                        // This catch handles network errors (e.g., offline)
                        console.log('Fetch failed; returning basic offline response.', error);
                        // Return a new, basic response. This prevents the "Failed to convert value to 'Response'" error.
                        return new Response(null, { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

// Sync event for background data synchronization
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync event triggered!');
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
    if (event.tag.startsWith('periodic-sync-')) {
        console.log(`Periodic sync event triggered for tag: ${event.tag}`);
        event.waitUntil(
             self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});
