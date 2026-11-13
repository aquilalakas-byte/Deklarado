// Night-before reminders (around 6 PM Philippine time):
//   • Holidays (from src/data/holidays.json) → everyone who has holiday reminders on
//   • My school-calendar events starting tomorrow → only the phone that saved them
// Each reminder is sent once (reminder_log table).

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import holidayData from "../src/data/holidays.json" with { type: "json" };

type Holiday = { date: string; type: string; name: string; nameFil: string };
const HOLIDAYS = holidayData.holidays as Holiday[];

export type ReminderSub = { id: number; endpoint: string; p256dh: string; auth: string; lang?: string | null; remind_holidays?: boolean | null; remind_events?: boolean | null };
export type PersonalEventRow = { endpoint: string; start_date: string; end_date: string; title: string; kind: string };

const manilaNow = () => new Date(Date.now() + 8 * 3600_000); // shift so getUTC* reads Philippine time
export const manilaHour = () => manilaNow().getUTCHours();
const manilaDate = (offsetDays = 0) => new Date(manilaNow().getTime() + offsetDays * 864e5).toISOString().slice(0, 10);

const dayLabel = (date: string, lang: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(lang === "fil" ? "fil-PH" : "en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

// ─── Messages (tested in reminders.test.ts) ──────────────────────────────────

export function holidayMessage(h: Holiday, language?: string | null) {
  const fil = language === "fil";
  const name = fil ? h.nameFil : h.name;
  const type = h.type === "regular" ? "Regular holiday" : "Special non-working day";
  return {
    title: fil ? `Bukas: Holiday — ${name}. Walang pasok.` : `Tomorrow: Holiday — ${name}. Walang pasok.`,
    body: `${dayLabel(h.date, fil ? "fil" : "en")} · ${type}`,
    url: "/calendar",
    tag: `holiday-${h.date}`,
  };
}

export function eventMessage(e: PersonalEventRow, language?: string | null) {
  const fil = language === "fil";
  const multi = e.end_date !== e.start_date ? ` (${fil ? "hanggang" : "until"} ${dayLabel(e.end_date, fil ? "fil" : "en")})` : "";
  let title: string;
  if (e.kind === "no_class") title = fil ? `Bukas: Walang klase — ${e.title}` : `Tomorrow: No classes — ${e.title}`;
  else title = fil ? `Bukas: ${e.title}` : `Tomorrow: ${e.title}`;
  const body = (fil ? "Mula sa school calendar mo" : "From your school calendar") + multi;
  return { title, body, url: "/calendar", tag: `event-${e.start_date}-${e.title.slice(0, 20)}` };
}

/** Is it reminder time? The scanner runs every 3 hours; the 6 PM run (17:00–20:59) sends them. */
export const isReminderWindow = (hour: number) => hour >= 17 && hour <= 20;

// ─── Sending ─────────────────────────────────────────────────────────────────

/** Records a reminder as sent. Returns false if it was already sent before. */
async function claim(db: SupabaseClient, key: string): Promise<boolean> {
  const { error } = await db.from("reminder_log").insert({ key });
  if (!error) return true;
  if (error.code === "23505") return false; // already sent
  throw new Error(`reminder_log: ${error.message}`);
}

export async function sendReminders(db: SupabaseClient, opts: { force?: boolean } = {}): Promise<string> {
  if (!opts.force && !isReminderWindow(manilaHour())) return "not reminder time (sent around 6 PM)";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || pub.startsWith("your-")) return "VAPID keys not set — skipped";

  // Needs migration 0004 (reminder_log, personal_events, remind_* columns)
  const probe = await db.from("reminder_log").select("key").limit(1);
  if (probe.error) return "reminder tables missing — run supabase/migrations/0004_calendar_reminders.sql";

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:change-me@example.com", pub, priv);

  const tomorrow = manilaDate(1);
  const { data: subsData, error: subErr } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, lang, remind_holidays, remind_events").limit(5000);
  if (subErr) throw new Error(`Loading subscriptions: ${subErr.message}`);
  const subs = (subsData ?? []) as ReminderSub[];
  const byEndpoint = new Map(subs.map((s) => [s.endpoint, s]));

  let sent = 0;
  const gone = new Set<number>();
  async function push(s: ReminderSub, payload: object) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 12 * 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.add(s.id);
      else console.warn(`  ! reminder push failed (${code ?? "?"}): ${(e as Error).message}`);
    }
  }

  // Holidays
  const holiday = HOLIDAYS.find((h) => h.date === tomorrow && h.type !== "special_working");
  if (holiday && (await claim(db, `holiday:${holiday.date}`))) {
    for (const s of subs) if (s.remind_holidays !== false) await push(s, holidayMessage(holiday, s.lang));
  }

  // My school-calendar events starting tomorrow
  const { data: evData, error: evErr } = await db.from("personal_events").select("endpoint, start_date, end_date, title, kind").eq("start_date", tomorrow);
  if (evErr) throw new Error(`Loading personal events: ${evErr.message}`);
  for (const e of (evData ?? []) as PersonalEventRow[]) {
    const s = byEndpoint.get(e.endpoint);
    if (!s || s.remind_events === false) continue;
    const key = "event:" + createHash("sha256").update(`${e.endpoint}|${e.start_date}|${e.title}`).digest("hex").slice(0, 32);
    if (await claim(db, key)) await push(s, eventMessage(e, s.lang));
  }

  if (gone.size) await db.from("push_subscriptions").delete().in("id", [...gone]);
  return `${sent} reminder(s) sent for ${tomorrow}${holiday ? ` (holiday: ${holiday.name})` : ""}`;
}
