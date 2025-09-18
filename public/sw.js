// public/sw.js

const CACHE_NAME = 'bizsuite-cache-v1';

// A minimal list of URLs to cache when the service worker is installed.
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

// Install a service worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        // Use addAll with individual requests to handle failures gracefully.
        const promises = urlsToCache.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[Service Worker] Failed to pre-cache: ${url}`, err);
          });
        });
        return Promise.all(promises);
      })
      .then(() => self.skipWaiting()) // Activate worker immediately
  );
});

// Activate the service worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  // Remove old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});


// Network first, then cache strategy
self.addEventListener('fetch', (event) => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }
    
    // For navigation requests, use network-first strategy.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('/')) // Fallback to the main app shell on network failure
        );
        return;
    }

    // For other requests (CSS, JS, images), use a network-first strategy.
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // IMPORTANT: Clone the response. A response is a stream
                // and because we want the browser to consume the response
                // as well as the cache consuming the response, we need
                // to clone it so we have two streams.
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response; // Original response is returned to the browser
            })
            .catch(() => {
                // If the network fails, try to serve from cache.
                return caches.match(event.request).then((response) => {
                    return response || new Response("You are offline. Some content may not be available.", {
                        status: 503,
                        statusText: "Service Unavailable",
                        headers: new Headers({ 'Content-Type': 'text/plain' })
                    });
                });
            })
    );
});
