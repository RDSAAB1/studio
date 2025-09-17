// public/sw.js

const CACHE_NAME = 'bizsuite-dataflow-cache-v1';
const DATA_CACHE_NAME = 'bizsuite-dataflow-data-v1';
const APP_SHELL_FILES = [
  // Primary application files
  '/',
  '/manifest.json',
  '/favicon.ico',

  // All of your application's pages/routes
  '/cash-bank',
  '/dashboard-overview',
  '/data-capture',
  '/expense-tracker',
  '/finance/loan-management',
  '/forgot-password',
  '/hr/attendance-tracking',
  '/hr/employee-database',
  '/hr/payroll-management',
  '/inventory/inventory-management',
  '/inventory/purchase-orders',
  '/inventory/supplier-information',
  '/login',
  '/marketing/analytics',
  '/marketing/campaigns',
  '/marketing/email-marketing',
  '/projects/collaboration',
  '/projects/dashboard',
  '/projects/management',
  '/projects/tasks',
  '/sales/customer-entry',
  '/sales/customer-management',
  '/sales/customer-payments',
  '/sales/customer-profile',
  '/sales/daily-supplier-report',
  '/sales/order-tracking',
  '/sales/product-catalog',
  '/sales/rtgs-report',
  '/sales/sales-reports',
  '/sales/supplier-entry',
  '/sales/supplier-payments',
  '/sales/supplier-profile',
  '/settings',
  '/settings/bank-management',
  '/settings/printer',

  // Static assets from your public directory
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// 1. Installation: Cache the application shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[Service Worker] Caching app shell');
        for (const file of APP_SHELL_FILES) {
          try {
            await cache.add(file);
          } catch (err) {
            console.warn(`[Service Worker] Failed to pre-cache: ${file}`, err);
          }
        }
      } catch (err) {
        console.error('[Service Worker] Failed to open cache:', err);
      }
      self.skipWaiting();
    })()
  );
});

// 2. Activation: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  const cacheWhitelist = [CACHE_NAME, DATA_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch: Serve from cache, and add new files to cache as they are requested
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (request.url.includes('/api/') || request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Cache-first strategy for all other GET requests
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.warn('[Service Worker] Fetch failed, serving from cache if available.', err);
        return caches.match('/');
      });
    })
  );
});


// 4. Sync: Handle background data synchronization
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync event received:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients && clients.length) {
          clients[0].postMessage({ type: 'SYNC_DATA' });
        }
      })
    );
  }
});

// 5. Periodic Sync: For regular updates
self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic sync event received:', event.tag);
  if (event.tag.startsWith('periodic-sync')) {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients && clients.length) {
          clients[0].postMessage({ type: 'SYNC_DATA' });
        }
      })
    );
  }
});

// 6. Push Notifications
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');
    const data = event.data ? event.data.json() : { title: 'New Notification', body: 'Something new happened!' };
    const title = data.title;
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// 7. Skip Waiting and claim clients immediately on update
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});