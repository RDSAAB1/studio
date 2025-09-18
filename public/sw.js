// public/sw.js

const CACHE_NAME = 'bizsuite-dataflow-cache-v2'; // Updated cache version

// URLs to be pre-cached. Keep this list minimal for faster installation.
const PRECACHE_URLS = [
    '/',
    '/dashboard-overview',
    '/login',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching essential app shell assets');
                return cache.addAll(PRECACHE_URLS);
            })
            .catch(error => {
                console.error('[Service Worker] Pre-caching failed:', error);
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // We only want to handle navigation requests with our network-first strategy
    if (event.request.mode !== 'navigate') {
        return; // Let the browser handle other requests (images, scripts, etc.)
    }

    event.respondWith(
        // Network-first strategy
        fetch(event.request)
            .then(response => {
                // If the fetch is successful, clone the response and cache it
                if (response.ok) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // If the network request fails, try to serve from the cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If not in cache, you could return a fallback offline page
                    // For now, we let the browser handle the error
                    return new Response("You are offline and this page isn't cached.", {
                        status: 503,
                        statusText: "Service Unavailable",
                        headers: new Headers({ "Content-Type": "text/html" })
                    });
                });
            })
    );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('[Service Worker] Background sync triggered!');
        event.waitUntil(
             self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                     client.postMessage({ type: 'SYNC_DATA' });
                });
            })
        );
    }
});
