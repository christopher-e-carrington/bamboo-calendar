// Notification-only service worker for Bamboo Calendar.
// It does NOT cache anything and is not an app-shell/offline worker.
// It handles two things:
//  1. showNotification() calls from the page (mobile browsers refuse `new Notification()`)
//  2. Web Push messages delivered while the app / browser is closed

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Bamboo Calendar";
  const options = {
    body: payload.body || "",
    tag: payload.tag,
    renotify: false,
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(
    (async () => {
      // Skip if the same alert is already on screen (e.g. shown by the open tab)
      const existing = await self.registration.getNotifications();
      if (existing.some((n) => (options.tag && n.tag === options.tag) || n.body === options.body)) {
        return;
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
