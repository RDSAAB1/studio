const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';

// App Shell: The minimal HTML, CSS, and JS required to power the user interface.
// We are caching the root route '/' which serves as the app shell for this Next.js app.
const urlsToCache = [
  '/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache and caching app shell');
      return cache.addAll(urlsToCache);
    }).then(() => {
      // Force the waiting service worker to become the active service worker.
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  // Claim control over all the clients that are in scope.
  event.waitUntil(self.clients.claim());

  // Clean up old caches.
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('bizsuite-dataflow-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
        // After activation, notify clients.
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({ type: 'SW_ACTIVATED' });
            });
        });
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle requests for scripts from the dev server.
  if (event.request.url.includes('localhost:') || event.request.url.includes(':3000') || event.request.url.includes('/_next/static/webpack')) {
    return;
  }
  
  // Ignore sync API calls
  if (event.request.url.includes('/api/sync')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cacheResponse) => {
      // If the request is in the cache, return it from the cache.
      if (cacheResponse) {
        return cacheResponse;
      }
      
      // If the request is not in the cache, fetch it from the network.
      return fetch(event.request).then((networkResponse) => {
        // Clone the response because it can only be consumed once.
        const responseToCache = networkResponse.clone();
        
        // Open the dynamic cache and add the new response to it.
        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            // We only cache successful GET requests.
            if(event.request.method === 'GET' && responseToCache.status === 200) {
              cache.put(event.request, responseToCache);
            }
        });
        
        // Return the network response.
        return networkResponse;
      }).catch(() => {
        // If the fetch fails (i.e., user is offline) and it's a navigation request,
        // serve the app shell from the cache.
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        // For other types of requests (e.g., images), if they are not in the cache
        // and the network fails, they will fail, which is acceptable.
        // We don't want to show a generic offline page for a missing image.
      });
    })
  );
});
