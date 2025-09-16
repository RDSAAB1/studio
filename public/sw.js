
const STATIC_CACHE_NAME = 'app-shell-cache-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';

// Pre-cache the main pages and essential assets
const APP_SHELL = [
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
  '/data-capture',
  '/settings',
  '/settings/bank-management',
  '/settings/printer',
  '/fallback.html' // A fallback page
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching App Shell');
      // Add all App Shell items. If one fails, the whole install fails.
      return Promise.all(APP_SHELL.map(url => {
        return cache.add(new Request(url, {cache: 'reload'})).catch(err => {
          console.warn(`[SW] Failed to cache ${url}`, err);
        });
      }));
    }).then(() => {
      console.log('[SW] App Shell Precaching Complete. Activating now.');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log('[SW] Clearing old cache', key);
            return caches.delete(key);
          }
        })
      ).then(() => {
        // Claim clients to take control immediately
        return self.clients.claim();
      }).then(() => {
        // Send a message to all clients that the SW is activated
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            console.log('[SW] Posting SW_ACTIVATED message to client:', client.id);
            client.postMessage({ type: 'SW_ACTIVATED' });
          });
        });
      })
    })
  );
});


self.addEventListener('fetch', (event) => {
    // For navigation requests, use a Network-First strategy to get the latest page.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                // If fetch is successful, cache it and return it
                return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request.url, response.clone());
                    return response;
                });
            })
            .catch(() => {
                // If fetch fails, try to get it from the cache
                return caches.match(event.request).then(response => {
                    // If it's in the cache, return it, otherwise show a fallback
                    return response || caches.match('/fallback.html');
                });
            })
        );
        return;
    }

    // For other requests (CSS, JS, images), use Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                // Found in cache, return it.
                // Then, fetch from network to update the cache for next time.
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request.url, networkResponse.clone());
                    });
                    return networkResponse;
                });
                return response;
            } else {
                // Not in cache, fetch from network, cache it, and return response.
                return fetch(event.request).then(networkResponse => {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                         // Don't cache chrome-extension requests
                        if (!event.request.url.startsWith('chrome-extension://')) {
                            cache.put(event.request.url, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                }).catch(() => {
                    // If network fails and it's not in cache, for non-navigation requests,
                    // we don't have a specific fallback, so the request will fail as it naturally would.
                });
            }
        })
    );
});
