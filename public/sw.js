// public/sw.js

const CACHE_NAME = 'bizsuite-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Add other critical assets like CSS, JS, fonts, and main images/icons here
  // The build process should ideally inject these file paths
];

// 1. Installation: Cache the App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .catch(error => {
        console.error('Failed to cache App Shell:', error);
      })
  );
});

// 2. Activation: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Fetch: Serve from cache first (Cache-First Strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // If the request is in the cache, return it
        if (response) {
          return response;
        }
        // Otherwise, fetch from the network, cache it, and return it
        return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          // Clone the response because it's a one-time use stream
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return networkResponse;
        });
      })
      .catch(error => {
        console.error('Service Worker fetch error:', error);
        // You might want to return a fallback offline page here
      })
  );
});

// 4. Background Sync: Triggered when network is available
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync event triggered.');
    event.waitUntil(syncData());
  }
});

// 5. Periodic Background Sync: Triggered periodically by the browser
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-sync') {
    console.log('Service Worker: Periodic background sync event triggered.');
    event.waitUntil(syncData());
  }
});


async function syncData() {
    // This is a simplified version of the sync logic from database.ts
    // We cannot use Dexie directly here, so we will use fetch to call an API endpoint
    // that does the sync. Let's assume this endpoint can trigger the sync logic.
    // A better approach is to use IndexedDB directly in the service worker.
    // For this implementation, we will assume the main app window handles the sync logic
    // and the sync event is just a trigger.
    // The main app window will listen for this and trigger its own syncData function.
    // Or, more simply, we can just trigger a sync API endpoint if we create one.

    // For this implementation, we'll assume the sync logic is available.
    // Since we cannot directly import from Dexie-based `database.ts`,
    // we need to communicate with the client or re-implement DB logic here.
    // A robust way is to message the client.
    
    return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            // Send a message to all open tabs/clients to trigger the sync.
            // The client-side code will need to listen for this message.
            console.log('Service Worker: Sending sync message to client.');
            client.postMessage({ type: 'SYNC_DATA' });
        });
    });
}
