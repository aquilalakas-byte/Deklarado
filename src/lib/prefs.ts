"use client";

// The user's saved choices (area + levels), kept in this browser's localStorage.
// Wrapped in try/catch because storage can be blocked (private mode, etc.) — the app still works, it just won't remember.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Level } from "./types";

export type Prefs = {
  areaCode: string | null; // the user's city/town
  levels: Level[];         // [] = all levels
  lang: "en" | "fil";      // app language
  sample: boolean;         // show sample announcements (for demos) instead of real data
  remindHolidays: boolean; // night-before reminder for holidays
  remindEvents: boolean;   // night-before reminder for my school-calendar events
};

const KEY = "deklarado:prefs";
const EVENT = "deklarado:prefs-changed";
const DEFAULT: Prefs = { areaCode: null, levels: [], lang: "en", sample: false, remindHolidays: true, remindEvents: true };

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** `ready` is false during server rendering / before the browser value is known. */
export function usePrefs() {
  const raw = useSyncExternalStore(subscribe, read, () => "__server__");
  const ready = raw !== "__server__";
  const prefs = useMemo<Prefs>(() => {
    if (!raw || raw === "__server__") return DEFAULT;
    try {
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch {
      return DEFAULT;
    }
  }, [raw]);

  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked — ignore
    }
    window.dispatchEvent(new Event(EVENT));
  }, [prefs]);

  return { prefs, ready, update };
}
