// Housemates — Web Push service worker.
// buildNotificationOptions is a pure helper so its behaviour can be locked by a
// test (see __tests__/serviceWorkerNotification.test.js). The options it sets —
// requireInteraction / tag+renotify / vibrate / silent:false — are what nudge
// Android (and its OEM skins) to show a "heads-up" (floating) notification
// instead of a silent status-bar-only one. The OS/manufacturer still has the
// final say, so this reduces but does not eliminate silent delivery.
function buildNotificationOptions(payload) {
  const data = payload.data || {};
  // A tag lets a follow-up notification of the same kind re-alert (with
  // renotify) instead of stacking silently. Fall back to a single app-wide tag
  // so every push at least re-alerts rather than landing quietly.
  const tag = payload.tag || data.type || data.screen || 'housemates';
  return {
    body: payload.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data,
    tag,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
  };
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('push', (event) => {
    if (!event.data) return;
    let payload;
    try {
      payload = event.data.json() ?? {};
    } catch {
      payload = { title: 'Housemates', body: event.data.text() };
    }
    event.waitUntil(
      self.registration.showNotification(
        payload.title || 'Housemates',
        buildNotificationOptions(payload)
      )
    );
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const screen = event.notification.data?.screen;
    const url = screen ? `/${screen}` : '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow(url);
      })
    );
  });
}

// Exposed for unit tests running under Node/Jest; ignored in the SW runtime.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildNotificationOptions };
}
