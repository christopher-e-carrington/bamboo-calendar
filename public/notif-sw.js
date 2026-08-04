// Notification-only service worker for Bamboo Calendar.
// It does NOT cache anything and is not an app-shell/offline worker.
// Mobile browsers (Android Chrome) refuse `new Notification()`; notifications
// must be shown through a service worker registration.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })(),
  );
});
