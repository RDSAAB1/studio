// This is a basic service worker file.
// We will add more functionality here in the next steps.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
});

self.addEventListener('fetch', (event) => {
  // We will add caching strategies here later.
});
