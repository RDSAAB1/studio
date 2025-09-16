// Give your cache a name
const CACHE_NAME = 'bizsuite-dataflow-cache-v1';

// List all the files you want to cache
const URLS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Add paths to your main CSS, JS, and any other essential assets
  // For Next.js, these paths might be hashed, so a more advanced strategy
  // might be needed for production, but this is a good start.
  // We'll also cache the icons defined in the manifest.
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 'install' event: opens the cache and adds the App Shell files to it
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('Failed to open cache', err);
      })
  );
});

// 'activate' event: cleans up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 'fetch' event: serves assets from cache first (Cache First strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});
