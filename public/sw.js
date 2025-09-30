
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }));
  });
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag.startsWith('periodic-sync-')) {
    event.waitUntil(handlePeriodicSync());
  }
});

async function handlePeriodicSync() {
  console.log('Periodic sync event received, attempting to sync data...');
  // You need a way to trigger the sync function from your app's code.
  // This is tricky because the service worker has a different scope.
  // One way is to open a client and send a message.
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  });

  if (clients && clients.length) {
    clients[0].postMessage({ type: 'SYNC_DATA_REQUEST' });
  } else {
    console.log("No active client to trigger data sync.");
  }
}
