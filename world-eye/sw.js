const CACHE_NAME = 'world-eye-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '🚨 紧急报警', body: '有成员发出了紧急报警！', name: '' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/assets/image/2026-05-29-icon.jpg',
    badge: '/assets/image/2026-05-29-icon.jpg',
    vibrate: [500, 100, 500, 100, 500, 200, 800, 100, 800],
    tag: 'world-eye-alarm',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'locate', title: '📍 定位 TA' },
      { action: 'dismiss', title: '收到' }
    ],
    data: {
      url: '/world-eye/',
      lat: data.lat,
      lng: data.lng,
      memberId: data.memberId
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/world-eye/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/world-eye') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
