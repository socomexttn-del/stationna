// Volt Taxi Service Worker for Push Notifications

const CACHE_NAME = 'volt-taxi-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification Volt Taxi',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'volt-taxi-notification',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  if (event.data) {
    try {
      const data = JSON.parse(event.data.text());
      options.body = data.body || options.body;
      options.data = data;
      
      if (data.title) {
        event.waitUntil(
          self.registration.showNotification(data.title, options)
        );
        return;
      }
    } catch (e) {
      // Not JSON, use as plain text
    }
  }

  event.waitUntil(
    self.registration.showNotification('Volt Taxi', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Message event for showing notifications from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    
    self.registration.showNotification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      tag: 'volt-taxi-notification',
      renotify: true,
      data
    });
  }
});
