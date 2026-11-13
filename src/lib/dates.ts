// All dates in the app are Philippine dates (Asia/Manila), stored as "YYYY-MM-DD".
// Display functions take the app language ("en" or "fil").

import type { Lang, T } from "./i18n";

const TZ = "Asia/Manila";
const loc = (lang: Lang) => (lang === "fil" ? "fil-PH" : "en-PH");

export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const asUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "Fri, Nov 13" / "Biy, Nob 13" */
export const shortDate = (iso: string, lang: Lang = "en") =>
  asUTC(iso).toLocaleDateString(loc(lang), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Friday, November 13, 2026" / "Biyernes, Nobyembre 13, 2026" */
export const longDate = (iso: string, lang: Lang = "en") =>
  asUTC(iso).toLocaleDateString(loc(lang), { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "November 2026" */
export const monthLabel = (year: number, month: number, lang: Lang = "en") =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(loc(lang), { month: "long", year: "numeric", timeZone: "UTC" });

/** "13:00:00" → "1:00 PM" */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "2 hours ago" / "2 oras na ang nakalipas" */
export function timeAgo(isoTimestamp: string, t: T, now = Date.now()): string {
  const mins = Math.round((now - new Date(isoTimestamp).getTime()) / 60000);
  if (mins < 1) return t("ago.now");
  if (mins < 60) return t("ago.min", { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t("ago.hour", { n: hrs });
  return t("ago.day", { n: Math.round(hrs / 24) });
}

export const isValidDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(asUTC(s).getTime());
