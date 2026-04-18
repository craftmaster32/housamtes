self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Housemates', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Housemates', {
      body: payload.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: payload.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const screen = event.notification.data?.screen;
  const url = screen ? `/${screen}` : '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});
