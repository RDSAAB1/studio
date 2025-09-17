// sw.js

const CACHE_NAME = 'bizsuite-v1';

// App Shell: Files that are essential for the app to work offline.
const urlsToCache = [
  '/',
  '/fallback', // A generic offline page
  '/manifest.json',
  '/styles/globals.css', // Adjust path based on your project structure
  // Add other critical assets like logo, main JS bundles if you know them.
  // Next.js generates hashed bundle names, so this is tricky. We'll cache dynamically.
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache).catch(err => {
            console.error("Failed to cache app shell on install:", err);
        });
      })
      .then(() => {
        console.log('Service Worker: Install completed');
        self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Service Worker: Activation completed');
        return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
    // For navigation requests (loading pages), use Stale-While-Revalidate
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                // 1. Return cached response if available
                return cache.match(event.request).then((cachedResponse) => {
                    // 2. Fetch from network in the background
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // If the fetch is successful, update the cache
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.error('Service Worker: Fetch failed; returning offline page instead.', error);
                        return caches.match('/fallback');
                    });
                    // Return cached response immediately, or wait for network if not cached
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // For other requests (CSS, JS, images, API calls), use a Cache-First strategy
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // If the request is in the cache, return it
                if (response) {
                    return response;
                }

                // If the request is not in the cache, fetch it from the network
                return fetch(event.request).then(
                    (networkResponse) => {
                        // Don't cache API calls or Chrome extension requests
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' || event.request.url.startsWith('chrome-extension://')) {
                            return networkResponse;
                        }

                        // Clone the response because it's a stream and can only be consumed once.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                );
            }).catch(error => {
                console.error('Service Worker: Error fetching and caching new data', error);
                // As a fallback for non-navigation requests, you might return a placeholder
                // For example, for images, you could return a placeholder image
                return caches.match('/fallback'); // Or a specific placeholder
            })
    );
});


self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
