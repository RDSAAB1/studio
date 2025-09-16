const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';
const CACHE_NAME = 'app-shell-v1';
const urlsToCache = [
  '/',
  '/fallback.html' // A simple offline fallback page
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', event => {
  // For API calls or non-GET requests, just fetch from network
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    // 1. Try the network first
    fetch(event.request).then(fetchRes => {
      // If successful, cache the response and return it
      return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        cache.put(event.request.url, fetchRes.clone());
        return fetchRes;
      });
    }).catch(() => {
      // 2. If network fails, try to get it from the cache
      return caches.match(event.request).then(cacheRes => {
        if (cacheRes) {
          return cacheRes;
        }
        // 3. If it's not in the cache, show a fallback page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/fallback.html');
        }
        // For other assets (JS, CSS, images), there's no specific fallback, so it will just fail.
        // This is okay as the main navigation will be handled.
      });
    })
  );
});

// Activate the service worker and remove old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
