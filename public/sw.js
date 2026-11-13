// Deklarado service worker.
// Runs in the background (even when the app is closed) to show push notifications.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A push message arrives from the scanner.
// Payload: { title, body, url, tag }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Deklarado";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "A new announcement is available.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || "deklarado", // same tag = replaces the older notification instead of stacking
      renotify: true,
      data: { url: data.url || "/" },
    }),
  );
});

// Tapping the notification opens (or focuses) the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin)) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
