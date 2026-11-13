"use client";

// "Install app" support.
//  • Chrome / Edge / Android fire `beforeinstallprompt`; we keep that event and replay it when the user taps Install.
//  • iPhone/iPad Safari has no such event — users must use Share → Add to Home Screen, so we show a guide.
//  • In-app browsers (Messenger, Facebook, Instagram) can't install at all — users must open the link in Chrome/Safari.

import { useSyncExternalStore } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Listen as early as possible: the browser fires this event once, often right after the page loads.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own button instead of the browser's mini-bar
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export type InstallMode =
  | "installed"   // already running as an installed app
  | "prompt"      // we can show the browser's install popup (Android/Chrome/Edge)
  | "ios"         // iPhone/iPad Safari: show the Share → Add to Home Screen guide
  | "inapp"       // Messenger/Facebook/Instagram browser: tell them to open in Chrome/Safari
  | "manual";     // other browsers: point them to the browser menu

function detect(): InstallMode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (standalone || installedNow) return "installed";
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\//i.test(ua)) return "inapp";
  if (deferred) return "prompt";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "manual";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** null while rendering on the server. */
export function useInstallMode(): InstallMode | null {
  return useSyncExternalStore(subscribe, detect, () => null);
}

/** Shows the browser's install popup. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null; // the event can only be used once
  await e.prompt();
  const { outcome } = await e.userChoice;
  emit();
  return outcome === "accepted";
}
