
const CACHE_NAME = 'bizsuite-dataflow-v2'; // Incremented cache version

// This is not exhaustive, but covers the main app shell and common assets.
// Next.js build artifacts are hard to predict, so we focus on runtime caching.
const APP_SHELL_URLS = [
  '/',
];

// Install: Cache the app shell
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        // Add all core assets to the cache
        return cache.addAll(APP_SHELL_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Don't handle non-GET requests or specific API/auth routes
  if (request.method !== 'GET' || request.url.includes('/api/') || request.url.includes('/_next/static/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        
        // 1. Fetch from network in the background
        const fetchPromise = fetch(request).then((networkResponse) => {
          // If fetch is successful, update the cache
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
          // Network fetch failed, which is expected when offline.
          // console.warn('Service Worker: Network fetch failed.', error);
        });

        // 2. Return cached response immediately if available, otherwise wait for fetch
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Background Sync Logic
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync event triggered.');
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag.startsWith('periodic-sync-')) {
        console.log(`Service Worker: Periodic sync event for ${event.tag} triggered.`);
        event.waitUntil(
             self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});
