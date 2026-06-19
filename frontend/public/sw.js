// StationCab Service Worker for Push Notifications
// Handles notifications even when phone is in sleep mode or app is closed

const CACHE_NAME = 'stationcab-v2';

// Install event
self.addEventListener('install', (event) => {
  console.log('[StationCab SW] Installing...');
  self.skipWaiting();
});

// Activate event  
self.addEventListener('activate', (event) => {
  console.log('[StationCab SW] Activated');
  event.waitUntil(clients.claim());
});

// Push notification received from server (WORKS IN BACKGROUND!)
self.addEventListener('push', (event) => {
  console.log('[StationCab SW] Push received:', event);
  
  let notificationData = {
    title: 'StationCab',
    body: 'Nouvelle notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'stationcab-' + Date.now(),
    requireInteraction: true,
    vibrate: [400, 150, 400, 150, 600], // Urgent pattern
    data: {}
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[StationCab SW] Push payload:', payload);
      
      notificationData = {
        title: payload.title || 'StationCab - Nouvelle course!',
        body: payload.body || payload.message || 'Une nouvelle course est disponible',
        icon: payload.icon || '/logo192.png',
        badge: '/logo192.png',
        tag: payload.tag || 'stationcab-ride-' + Date.now(),
        requireInteraction: true, // Keep until user taps
        vibrate: [400, 150, 400, 150, 600, 300], // Strong vibration
        renotify: true, // Always notify even if same tag
        silent: false,
        data: payload.data || payload,
        actions: [
          { action: 'accept', title: '✓ Voir' },
          { action: 'dismiss', title: '✗ Ignorer' }
        ]
      };
    } catch (e) {
      console.log('[StationCab SW] Push data parse error:', e);
      notificationData.body = event.data.text();
    }
  }
  
  // Show notification - THIS WORKS EVEN IN SLEEP MODE
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[StationCab SW] Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const data = event.notification.data || {};
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Notify the app about the click
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            action: event.action,
            data: data
          });
          return;
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(data.url || '/');
      }
    })
  );
});

// Message from main app
self.addEventListener('message', (event) => {
  console.log('[StationCab SW] Message:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    
    self.registration.showNotification(title || 'StationCab', {
      body: body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [400, 150, 400, 150, 600],
      tag: 'stationcab-local-' + Date.now(),
      requireInteraction: true,
      renotify: true,
      data: data
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync when coming back online
self.addEventListener('sync', (event) => {
  console.log('[StationCab SW] Background sync:', event.tag);
  if (event.tag === 'sync-rides') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const allClients = await clients.matchAll();
  allClients.forEach(client => {
    client.postMessage({ type: 'SYNC_RIDES' });
  });
}

console.log('[StationCab SW] Service Worker loaded');
