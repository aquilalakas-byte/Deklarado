// All dates in the app are Philippine dates (Asia/Manila), stored as "YYYY-MM-DD".

const TZ = "Asia/Manila";

export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const asUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "Fri, Nov 13" */
export const shortDate = (iso: string) =>
  asUTC(iso).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Friday, November 13, 2026" */
export const longDate = (iso: string) =>
  asUTC(iso).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "November 2026" */
export const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

/** "13:00:00" → "1:00 PM" */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "2 hours ago" style text for timestamps. */
export function timeAgo(isoTimestamp: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(isoTimestamp).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const isValidDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(asUTC(s).getTime());
