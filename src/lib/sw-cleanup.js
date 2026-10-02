// TNG does not use a service worker. If a previous production build ever
// registered one, remove it so Safari cannot keep serving a stale app shell.
async function clearLegacyTngBrowserCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn('[TNG cache cleanup] service worker cleanup failed', error);
  }

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch (error) {
    console.warn('[TNG cache cleanup] cache storage cleanup failed', error);
  }
}

window.addEventListener('load', () => {
  clearLegacyTngBrowserCaches();
}, { once: true });

// Safari can restore an old DOM + JS snapshot from its back/forward cache
// without requesting the latest index.html. A persisted pageshow means the
// page came from that snapshot, so reload it from the network.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});
