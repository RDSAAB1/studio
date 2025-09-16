// sw.js

const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
const urlsToCache = [
  '/',
  '/dashboard-overview',
  '/sales/supplier-entry',
  '/sales/customer-entry',
  '/sales/supplier-payments',
  '/sales/customer-payments',
  '/sales/supplier-profile',
  '/sales/customer-profile',
  '/cash-bank',
  '/expense-tracker',
  '/sales/rtgs-report',
  '/sales/daily-supplier-report',
  '/hr/employee-database',
  '/hr/payroll-management',
  '/hr/attendance-tracking',
  '/inventory/inventory-management',
  '/inventory/purchase-orders',
  '/projects/dashboard',
  '/projects/management',
  '/projects/tasks',
  '/projects/collaboration',
  '/data-capture',
  '/settings',
  '/settings/bank-management',
  '/settings/printer',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: App shell cached successfully');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  // Claim clients to take control of the page without a reload
  event.waitUntil(self.clients.claim());
  // Send a message to the client to notify of activation
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }));
  });

  // Clean up old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});


self.addEventListener('fetch', event => {
  // Let the browser handle requests for scripts from cloudworkstations.dev
  if (event.request.url.includes('cloudworkstations.dev/_next/static/')) {
    return;
  }

  // Handle navigation requests (for pages) with a network-first strategy, falling back to cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If network fails, serve the root from cache, allowing client-side routing to take over.
        return caches.match('/');
      })
    );
    return;
  }
  
  // For all other requests (CSS, JS, images), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If the response is in the cache, return it
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not in cache, fetch from the network
        return fetch(event.request).then(networkResponse => {
          // Clone the response because it's a stream and can only be consumed once
          const responseToCache = networkResponse.clone();
          
          // Open the dynamic cache and add the new response
          caches.open('dynamic-cache-v1')
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          // Return the original network response to the browser
          return networkResponse;
        }).catch(error => {
          // This catch is crucial for when the user is offline and the resource is not in the cache.
          console.error('Fetch failed; returning offline fallback or error. URL:', event.request.url, error);
          // Here you could return a generic offline fallback for images, etc. if you have one.
          // For now, we let the browser handle the error, which avoids the TypeError.
        });
      })
  );
});

// Listen for sync events
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync event triggered.');
        // Notify clients to perform the sync.
        event.waitUntil(
             self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'SYNC_DATA' }));
            })
        );
    }
});
