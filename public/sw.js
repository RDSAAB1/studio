
const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/dashboard-overview',
  '/sales/supplier-entry',
  '/sales/supplier-payments',
  '/sales/supplier-profile',
  '/sales/customer-entry',
  '/sales/customer-payments',
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
];

// Install event: precache the app shell and other important assets.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and precaching URLs');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// Activate event: clean up old caches and take control of clients.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
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
        // Take control of all open clients (tabs) to ensure the new SW is used.
        return self.clients.claim();
    }).then(() => {
        // Notify clients that the new service worker is active.
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }));
        });
    })
  );
});

// Fetch event: serve from cache first, then network.
self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the response is in the cache, return it.
        if (response) {
          return response;
        }

        // If the response is not in the cache, fetch it from the network.
        return fetch(event.request)
          .then(networkResponse => {
            // And also cache the new response for future use.
            return caches.open(CACHE_NAME).then(cache => {
              // We have to clone the response because it's a stream and can only be consumed once.
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          });
      })
      .catch(() => {
        // If both cache and network fail (e.g., offline and not in cache),
        // you could return a fallback page here.
        // For now, it will result in the default browser offline error.
      })
  );
});
