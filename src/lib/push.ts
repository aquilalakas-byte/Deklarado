"use client";

// Browser side of push notifications: register the service worker, ask permission,
// subscribe, and tell our server which area/levels this phone wants alerts for.

import type { Level } from "./types";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "ok" | "unsupported" | "ios-install" | "no-key";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
  // iPhones only allow web push for apps added to the Home Screen (iOS 16.4+)
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!PUBLIC_KEY || PUBLIC_KEY.startsWith("your-")) return "no-key";
  return "ok";
}

export async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function save(sub: PushSubscription, areaCode: string, levels: Level[], lang: string) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), areaCode, levels, lang }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // .status lets the screen show a translated message (503 = database not connected yet)
    throw Object.assign(new Error(body.error ?? `Server error (${res.status})`), { status: res.status });
  }
}

/** Ask permission, subscribe this browser, and save it. Throws a readable Error on failure. */
export async function enablePush(areaCode: string, levels: Level[], lang: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings for this site.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  try {
    await save(sub, areaCode, levels, lang);
  } catch (e) {
    await sub.unsubscribe().catch(() => {}); // keep browser and server in sync
    throw e;
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

/** After the user changes area or levels, update the server copy. */
export async function syncPush(areaCode: string, levels: Level[], lang: string): Promise<void> {
  const sub = await currentSubscription();
  if (sub) await save(sub, areaCode, levels, lang);
}

/** Shows a sample notification right away (no server needed) so users can check it works. */
export async function testNotification(title: string, body: string): Promise<void> {
  const reg = await registration();
  await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: "deklarado-test",
    data: { url: "/" },
  });
}
