"use client";

// Holidays (from the official Proclamations) and the user's personal school-calendar events.
// Personal events are saved on this phone. If notifications are on, a private copy goes to the
// server tied to this phone's notification subscription, only so night-before reminders can be sent.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import holidayData from "@/data/holidays.json";
import type { EventKind } from "./parseCalendar";
import { currentSubscription } from "./push";

export type Holiday = { date: string; type: "regular" | "special" | "special_working"; name: string; nameFil: string };
export const HOLIDAYS = holidayData.holidays as Holiday[];
const HOLIDAY_BY_DATE = new Map(HOLIDAYS.map((h) => [h.date, h]));

export const holidayOn = (date: string) => HOLIDAY_BY_DATE.get(date);
/** Regular and special NON-working days mean no classes. Special WORKING days don't. */
export const isDayOff = (h: Holiday | undefined) => !!h && h.type !== "special_working";

export type PersonalEvent = { id: string; start: string; end: string; title: string; kind: EventKind };

export const eventsOn = (events: PersonalEvent[], date: string) => events.filter((e) => e.start <= date && date <= e.end);

// ─── Saved on this phone ─────────────────────────────────────────────────────

const KEY = "deklarado:events";
const EVENT = "deklarado:events-changed";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
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

/** Sends this phone's events to the server (only if notifications are on). Safe to call any time. */
export async function syncEventsToServer(events?: PersonalEvent[]): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  const list = events ?? (JSON.parse(read()) as PersonalEvent[]);
  await fetch("/api/my-events", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, events: list.map(({ start, end, title, kind }) => ({ start, end, title, kind })) }),
  }).catch(() => {});
}

export function usePersonalEvents() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const events = useMemo<PersonalEvent[]>(() => {
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, [raw]);

  const save = useCallback((next: PersonalEvent[]) => {
    const sorted = [...next].sort((a, b) => a.start.localeCompare(b.start)).slice(0, 300);
    try {
      localStorage.setItem(KEY, JSON.stringify(sorted));
    } catch {
      // storage blocked
    }
    window.dispatchEvent(new Event(EVENT));
    void syncEventsToServer(sorted);
  }, []);

  const add = useCallback((items: Omit<PersonalEvent, "id">[]) => {
    save([...events, ...items.map((e) => ({ ...e, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }))]);
  }, [events, save]);

  const remove = useCallback((id: string) => save(events.filter((e) => e.id !== id)), [events, save]);
  const clear = useCallback(() => save([]), [save]);

  return { events, add, remove, clear };
}
