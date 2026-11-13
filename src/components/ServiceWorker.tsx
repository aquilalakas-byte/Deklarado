"use client";

import { useEffect } from "react";

/** Registers the service worker once, so the app is installable and can receive notifications. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // not fatal — the app works without it, just no notifications
      });
    }
  }, []);
  return null;
}
