// Sample announcements shown while the database isn't connected yet (and for demos/defense).
// Dates are relative to today so the app always has something to show.

import { addDays, manilaToday } from "./dates";
import type { Announcement, WindSignal } from "./types";

const GMA = "GMA News – Walang Pasok";
const GMA_URL = "https://www.gmanetwork.com/news/tracking/walang_pasok/";

type Seed = Partial<Announcement> & Pick<Announcement, "area_code" | "summary"> & { day: number };

const SEEDS: Seed[] = [
  { day: 0, area_code: "035416000", summary: "San Fernando, Pampanga - all levels, public and private", reason: "Tropical Storm signal no. 2", lgu_post_url: "https://www.facebook.com/cityofsanfernandopampanga" },
  { day: 0, area_code: "035401000", summary: "Angeles City - face-to-face classes suspended (all levels, public and private)", f2f_only: true, reason: "heavy rains and flooding" },
  { day: 1, area_code: "035400000", summary: "Pampanga province - Kinder to Grade 6, public", levels: ["kinder", "elementary"], sector: "public", reason: "Tropical Storm signal no. 1" },
  { day: 1, area_code: "035408000", summary: "Lubao - starting 1 p.m., all levels, public and private", starts_at: "13:00:00", reason: "scheduled power interruption" },
  { day: -2, area_code: "035407000", summary: "Guagua - all levels, public and private, including government offices", includes_work: true, reason: "town fiesta" },
  { day: -5, area_code: "035409000", summary: "Mabalacat City - Special non-working holiday", kind: "holiday", includes_work: true, reason: "founding anniversary" },
  { day: -9, area_code: "035416000", summary: "City of San Fernando, Pampanga - college level only", levels: ["college"], reason: "extreme heat index" },
  { day: 4, area_code: "000000000", summary: "Nationwide - Special non-working day", kind: "holiday", includes_work: true, reason: "national holiday", is_official: true, source_name: "Official Gazette (sample)" },
];

/** A sample PAGASA Wind Signal so the banner can be seen in demo mode. */
export function demoSignals(): WindSignal[] {
  return [
    { area_code: "035416000", level: 1, storm: "Tropical Storm SAMPLE", bulletin_no: "5", issued: "11:00 AM today", bulletin_url: "https://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin" },
  ];
}

export function demoAnnouncements(today = manilaToday()): Announcement[] {
  const now = new Date().toISOString();
  return SEEDS.map((s, i) => ({
    id: -(i + 1),
    kind: "class_suspension",
    levels: ["all"],
    sector: "both",
    starts_at: null,
    f2f_only: false,
    includes_work: false,
    reason: null,
    source_name: GMA,
    source_url: GMA_URL,
    lgu_post_url: null,
    is_official: false,
    created_at: now,
    updated_at: now,
    ...s,
    date_covered: addDays(today, s.day),
  })) as Announcement[];
}
