// Service worker cleanup for development
// Prevents stale cached JS from causing React hook errors
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        // Unregister any service workers in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          registration.unregister();
        }
      });
    });
    
    // Clear all caches
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  });
}