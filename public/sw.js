// A custom service worker with a pre-caching and stale-while-revalidate strategy.

const PRECACHE_VERSION = 'v1';
const PRECACHE_NAME = 'app-shell-cache-' + PRECACHE_VERSION;
const RUNTIME_CACHE_NAME = 'runtime-cache';

// A list of all the essential files to pre-cache.
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
  // You might need to add specific JS/CSS chunks if Next.js doesn't name them consistently.
  // However, the runtime caching should handle them.
];


// The install handler takes care of pre-caching the resources we always need.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
  );
});

// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate', event => {
  const currentCaches = [PRECACHE_NAME, RUNTIME_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// The fetch handler serves assets from cache or network.
self.addEventListener('fetch', event => {
    const { request } = event;
    // Skip non-GET requests, and requests for browser extensions or Next.js specific dev files.
    if (request.method !== 'GET' || request.url.startsWith('chrome-extension://') || request.url.includes('/_next/static/webpack')) {
        return;
    }

    // For navigation requests (pages), use a network-first strategy to ensure users get the latest HTML.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                // If the network fails, fall back to the precached root page.
                // This is a basic fallback; a more robust solution might match a specific offline page.
                return caches.match('/');
            })
        );
        return;
    }

    // For other requests (JS, CSS, images), use Stale-While-Revalidate strategy.
    event.respondWith(
        caches.open(RUNTIME_CACHE_NAME).then(cache => {
            return cache.match(request).then(cachedResponse => {
                const fetchPromise = fetch(request).then(networkResponse => {
                    // If the fetch is successful, clone the response and cache it.
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                });

                // Return the cached response immediately if it exists,
                // otherwise wait for the network response.
                return cachedResponse || fetchPromise;
            });
        }).catch(() => {
            // A final fallback in case both cache and network fail,
            // though this is unlikely with Stale-While-Revalidate.
            // This prevents the "Failed to fetch" error.
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
        })
    );
});
