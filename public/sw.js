
const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';

// URLs to pre-cache. These are the "app shell" files.
const urlsToCache = [
  '/',
  '/dashboard-overview',
  '/sales/supplier-entry',
  '/sales/customer-entry',
  '/sales/supplier-payments',
  '/sales/customer-payments',
  '/cash-bank',
  '/expense-tracker',
  '/settings'
];

// Install a service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker.
  );
});

// Activate the service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Service Worker activated and claimed clients.');
        // Tell the active service worker to take control of the page immediately.
        return self.clients.claim().then(() => {
            // After claiming, send a message to the clients.
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }));
            });
        });
    })
  );
});

// Listen for requests
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests (like POST), and API/sync calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Strategy: Network First, Falling Back to Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If the fetch is successful, cache the response and return it
        const responseToCache = networkResponse.clone();
        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // If the network request fails, try to find it in any cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Optional: Return a fallback page if nothing is found in the cache
          // return caches.match('/fallback.html');
          return new Response("You are Offline. This page could not be loaded because it's not in the cache.", {
            status: 404,
            statusText: "Offline",
            headers: { 'Content-Type': 'text/html' }
          });
        });
      })
  );
});
