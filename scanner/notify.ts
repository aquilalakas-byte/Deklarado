// Sends push notifications for new announcements.
//
// Who gets an alert:
//   • Town announcement      → people who chose that town
//   • Province announcement  → people in any town of that province
//   • Nationwide             → everyone
// …and only if the levels match what they follow. Each announcement is sent once (notified_at).

import type { SupabaseClient } from "@supabase/supabase-js";
import areasData from "../src/data/areas.json" with { type: "json" };
import type { Area } from "./classify.ts";

const AREAS = areasData as Area[];
const BY_CODE = new Map(AREAS.map((a) => [a.code, a]));

export type AnnouncementRow = {
  id: number;
  area_code: string;
  kind: "class_suspension" | "work_suspension" | "holiday" | "resumption";
  levels: string[];
  sector: "public" | "private" | "both";
  date_covered: string;
  starts_at: string | null;
  f2f_only: boolean;
  reason: string | null;
};

export type Lang = "en" | "fil";
export type SubscriptionRow = { id: number; endpoint: string; p256dh: string; auth: string; area_code: string; levels: string[]; lang?: string | null };

// Notification wording in English and Filipino. Users get alerts in the language they picked in the app.
const TEXT = {
  en: {
    levels: { kinder: "Kinder", elementary: "Elem", jhs: "JHS", shs: "SHS", college: "College" } as Record<string, string>,
    allLevels: "All levels",
    sector: { both: "public & private", public: "public schools", private: "private schools" },
    nationwide: "Nationwide",
    wholeProvince: (p: string) => `${p} (whole province)`,
    today: "Today", tomorrow: "Tomorrow", locale: "en-PH",
    resume: "Classes resume", walangPasok: "Walang pasok", work: "Government work suspended",
    noF2f: "No face-to-face classes", from: (t: string) => `Walang pasok from ${t}`,
    some: (l: string) => `Classes suspended (${l})`, holiday: "Non-working day",
    signal: (n: number) => `Wind Signal No. ${n} raised`, storm: "Tropical cyclone",
    issued: (i: string) => `PAGASA, issued ${i}`, watch: "Watch for class suspension announcements.",
  },
  fil: {
    levels: { kinder: "Kinder", elementary: "Elem", jhs: "JHS", shs: "SHS", college: "Kolehiyo" } as Record<string, string>,
    allLevels: "Lahat ng antas",
    sector: { both: "pampubliko at pribado", public: "pampublikong paaralan", private: "pribadong paaralan" },
    nationwide: "Buong bansa",
    wholeProvince: (p: string) => `${p} (buong probinsya)`,
    today: "Ngayon", tomorrow: "Bukas", locale: "fil-PH",
    resume: "Tuloy ang klase", walangPasok: "Walang pasok", work: "Walang pasok sa gobyerno",
    noF2f: "Walang face-to-face na klase", from: (t: string) => `Walang pasok simula ${t}`,
    some: (l: string) => `Suspendido ang klase (${l})`, holiday: "Non-working day",
    signal: (n: number) => `Nakataas ang Wind Signal No. ${n}`, storm: "Bagyo",
    issued: (i: string) => `PAGASA, inilabas ${i}`, watch: "Abangan ang anunsyo ng suspensyon ng klase.",
  },
};

const langOf = (l?: string | null): Lang => (l === "fil" ? "fil" : "en");

// ─── Pure helpers (tested in notify.test.ts) ─────────────────────────────────

/** Every area code inside `code`, including itself. */
export function insideCodes(code: string): Set<string> {
  const out = new Set([code]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of AREAS) if (a.parent_code && out.has(a.parent_code) && !out.has(a.code)) { out.add(a.code); grew = true; }
  }
  return out;
}

export function wantsIt(sub: Pick<SubscriptionRow, "area_code" | "levels">, a: Pick<AnnouncementRow, "area_code" | "levels">): boolean {
  if (!insideCodes(a.area_code).has(sub.area_code)) return false;
  if (sub.levels.includes("all") || a.levels.includes("all")) return true;
  return a.levels.some((l) => sub.levels.includes(l));
}

function placeName(code: string, lang: Lang): string {
  const a = BY_CODE.get(code);
  const tx = TEXT[lang];
  if (!a) return "?";
  if (a.type === "national") return tx.nationwide;
  if (a.type === "province") return tx.wholeProvince(a.name);
  const m = a.name.match(/^City of (.+)$/);
  return m ? `${m[1]} City` : a.name;
}

function timeText(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function dayText(date: string, today: string, lang: Lang): string {
  const tx = TEXT[lang];
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString(tx.locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (date === today) return `${tx.today}, ${label}`;
  if (date === tomorrow.toISOString().slice(0, 10)) return `${tx.tomorrow}, ${label}`;
  return label;
}

export function buildMessage(a: AnnouncementRow, today: string, language?: string | null) {
  const lang = langOf(language);
  const tx = TEXT[lang];
  const place = placeName(a.area_code, lang);
  const levels = a.levels.includes("all") ? tx.allLevels : a.levels.map((l) => tx.levels[l] ?? l).join(", ");

  let head: string;
  if (a.kind === "resumption") head = tx.resume;
  else if (a.kind === "holiday") head = tx.walangPasok;
  else if (a.kind === "work_suspension") head = tx.work;
  else if (a.f2f_only) head = tx.noF2f;
  else if (a.starts_at) head = tx.from(timeText(a.starts_at));
  else if (!a.levels.includes("all")) head = tx.some(levels);
  else head = tx.walangPasok;

  const parts = [dayText(a.date_covered, today, lang)];
  if (a.kind === "holiday") parts.push(tx.holiday);
  else if (a.kind !== "work_suspension") parts.push(`${levels}, ${tx.sector[a.sector]}`);
  if (a.reason) parts.push(a.reason.charAt(0).toUpperCase() + a.reason.slice(1));

  return { title: `${head} — ${place}`, body: parts.join(" · "), url: "/", tag: `${a.area_code}-${a.date_covered}` };
}

export type SignalRow = { area_code: string; level: number; storm: string | null; bulletin_no: string | null; issued: string | null; notified_level: number };

/** "Wind Signal No. 2 raised — San Fernando City" (a weather alert, not a suspension). */
export function buildSignalMessage(s: SignalRow, language?: string | null) {
  const lang = langOf(language);
  const tx = TEXT[lang];
  const parts = [s.storm ?? tx.storm, s.issued ? tx.issued(s.issued) : "PAGASA", tx.watch];
  return {
    title: `${tx.signal(s.level)} — ${placeName(s.area_code, lang)}`,
    body: parts.join(" · "),
    url: "/",
    tag: `signal-${s.area_code}`,
  };
}

// ─── Sending ─────────────────────────────────────────────────────────────────

function manilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function sendNotifications(db: SupabaseClient): Promise<{ sent: number; skipped: string | null }> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:change-me@example.com";
  if (!pub || !priv || pub.startsWith("your-")) return { sent: 0, skipped: "VAPID keys not set — notifications skipped" };

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(subject, pub, priv);

  const today = manilaToday();
  const { data: pending, error } = await db
    .from("announcements")
    .select("id, area_code, kind, levels, sector, date_covered, starts_at, f2f_only, reason")
    .is("notified_at", null)
    .order("date_covered");
  if (error) throw new Error(`Loading new announcements: ${error.message}`);

  // Past dates are old news — mark them done without alerting anyone.
  const old = (pending ?? []).filter((a) => a.date_covered < today).map((a) => a.id);
  if (old.length) await db.from("announcements").update({ notified_at: new Date().toISOString() }).in("id", old);
  const fresh = ((pending ?? []) as AnnouncementRow[]).filter((a) => a.date_covered >= today);

  // Wind signals that went UP since users were last alerted. Signals that were lifted reset the counter.
  await db.from("wind_signals").update({ notified_level: 0 }).eq("level", 0).gt("notified_level", 0);
  const { data: signalRows } = await db.from("wind_signals").select("area_code, level, storm, bulletin_no, issued, notified_level").gt("level", 0);
  const signals = ((signalRows ?? []) as SignalRow[]).filter((s) => s.level > s.notified_level);

  if (!fresh.length && !signals.length) return { sent: 0, skipped: null };

  let subs: SubscriptionRow[] | null = null;
  const withLang = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, area_code, levels, lang").limit(5000);
  if (!withLang.error) subs = withLang.data as SubscriptionRow[];
  else {
    // Migration 0003 (adds "lang") may not be run yet — fall back to English for everyone.
    const plain = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, area_code, levels").limit(5000);
    if (plain.error) throw new Error(`Loading subscriptions: ${plain.error.message}`);
    subs = plain.data as SubscriptionRow[];
  }

  let sent = 0;
  const gone = new Set<number>();
  async function push(s: SubscriptionRow, payload: string) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 12 * 60 * 60 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.add(s.id); // the phone unsubscribed or the app was removed
      else console.warn(`  ! push failed (${code ?? "?"}): ${(e as Error).message}`);
    }
  }

  for (const a of fresh) {
    for (const s of (subs ?? []) as SubscriptionRow[]) {
      if (!gone.has(s.id) && wantsIt(s, a)) await push(s, JSON.stringify(buildMessage(a, today, s.lang)));
    }
    await db.from("announcements").update({ notified_at: new Date().toISOString() }).eq("id", a.id);
  }

  for (const sig of signals) {
    for (const s of (subs ?? []) as SubscriptionRow[]) {
      if (!gone.has(s.id) && s.area_code === sig.area_code) await push(s, JSON.stringify(buildSignalMessage(sig, s.lang)));
    }
    await db.from("wind_signals").update({ notified_level: sig.level }).eq("area_code", sig.area_code);
  }

  if (gone.size) await db.from("push_subscriptions").delete().in("id", [...gone]);
  return { sent, skipped: null };
}
