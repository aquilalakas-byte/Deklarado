// Deklarado service worker.
// 1. Shows push notifications (even when the app is closed).
// 2. Keeps the app working offline: pages and the latest announcements are saved on the phone,
//    so during a typhoon with weak signal people can still see the last known announcements.

const CACHE = "deklarado-v2";
const PAGES = ["/", "/calendar", "/browse", "/settings"];
const DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Save each page separately so one failure doesn't stop the rest
      Promise.all([...PAGES, "/manifest.webmanifest", "/icons/icon-192.png"].map((url) => cache.add(url).catch(() => {}))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("deklarado-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ─── Offline support ─────────────────────────────────────────────────────────

/** Announcements: try the internet first; if offline, use the saved copy (marked with x-deklarado-saved-at). */
async function announcements(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) {
      const body = await res.clone().arrayBuffer();
      const headers = new Headers(res.headers);
      headers.set("x-deklarado-saved-at", new Date().toISOString());
      await cache.put(request, new Response(body, { status: 200, headers }));
    }
    return res;
  } catch {
    const exact = await cache.match(request);
    if (exact) return exact;
    // The date range changes every day — fall back to the newest saved answer for the same area.
    const areas = new URL(request.url).searchParams.get("areas");
    let best = null;
    let bestTime = "";
    for (const key of await cache.keys()) {
      const url = new URL(key.url);
      if (url.pathname !== "/api/announcements" || url.searchParams.get("areas") !== areas) continue;
      const res = await cache.match(key);
      const savedAt = res?.headers.get("x-deklarado-saved-at") ?? "";
      if (savedAt > bestTime) { best = res; bestTime = savedAt; }
    }
    return best ?? new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "content-type": "application/json" } });
  }
}

/** Pages: internet first, saved copy when offline. */
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match("/")) ?? Response.error();
  }
}

/** Files that never change once built (/_next/static/…): saved copy first. In development, internet first. */
async function asset(request) {
  const cache = await caches.open(CACHE);
  if (!DEV) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/announcements") event.respondWith(announcements(request));
  else if (url.pathname.startsWith("/api/")) return; // other API calls need the internet
  else if (request.mode === "navigate") event.respondWith(page(request));
  else if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/icon.svg") {
    event.respondWith(asset(request));
  }
});

// ─── Push notifications ──────────────────────────────────────────────────────

// Payload: { title, body, url, tag }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Deklarado", {
      body: data.body || "",
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
