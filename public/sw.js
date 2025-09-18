// public/sw.js

const CACHE_NAME = 'bizsuite-cache-v1';

// All of your application's pages/routes and assets
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

// Install a service worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[Service Worker] Caching app shell');
        const promises = APP_SHELL_FILES.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[Service Worker] Failed to pre-cache: ${url}`, err);
          });
        });
        await Promise.all(promises);
      } catch (err) {
        console.error('[Service Worker] Failed to open cache:', err);
      }
      self.skipWaiting();
    })()
  );
});

// Activate the service worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (!cacheWhitelist.includes(cache)) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch with a cache-first strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-first for API calls to ensure fresh data
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for all other assets and pages
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // If nothing is in the cache, go to the network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return networkResponse;
      }).catch(() => {
        // A fallback for the main app shell if both network and cache fail
        return caches.match('/');
      });
    })
  );
});