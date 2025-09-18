// This is a basic service worker for a Progressive Web App (PWA).

const CACHE_NAME = 'bizsuite-dataflow-cache-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-512x512.png' // Only cache the icon that exists
];

// Install a service worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        const promises = urlsToCache.map(url => {
          return cache.add(url).catch(err => {
            console.error(`[Service Worker] Failed to pre-cache: ${url}`, err);
          });
        });
        return Promise.all(promises);
      })
      .then(() => {
        console.log('[Service Worker] All assets cached');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// Activate the service worker
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
    }).then(() => {
        console.log('[Service Worker] Claiming clients');
        // Tell the active service worker to take immediate
        // control of all of the clients under its scope.
        return self.clients.claim();
    })
  );
});

// Network-first caching strategy
self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If we get a valid response, we clone it and cache it.
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                // If the network request fails, try to get it from the cache.
                return caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        // If it's not in the cache, you could return a fallback page.
                        // For this example, we'll just let the browser handle the error.
                    });
            })
    );
});
