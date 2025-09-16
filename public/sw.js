// A robust service worker with a "Cache falling back to Network" strategy.

const CACHE_NAME = 'bizsuite-offline-v2';
const APP_SHELL_URLS = [
  '/',
  '/dashboard-overview',
  '/offline.html' // A fallback page
];

// 1. Install: Caches the basic app shell and a fallback offline page.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// 2. Activate: Cleans up old caches.
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

// 3. Fetch: Serves content from cache first, then falls back to the network.
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For navigation requests (loading a page), try network first, then cache, then offline page.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
            // If the network is available, cache the response and return it.
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
            });
            return response;
        })
        .catch(() => {
            // If the network fails, try to get the page from the cache.
            return caches.match(event.request).then((response) => {
                // If it's in the cache, return it. Otherwise, show the offline fallback page.
                return response || caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // For all other requests (JS, CSS, images, etc.), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then((response) => {
      // If the resource is in the cache, return it.
      if (response) {
        return response;
      }
      // If not, fetch it from the network, cache it, and then return it.
      return fetch(event.request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // If both cache and network fail (e.g., for an image), do nothing.
        // The browser will show its default broken resource icon.
      });
    })
  );
});
