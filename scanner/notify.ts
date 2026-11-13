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

export type SubscriptionRow = { id: number; endpoint: string; p256dh: string; auth: string; area_code: string; levels: string[] };

const LEVEL_SHORT: Record<string, string> = { kinder: "Kinder", elementary: "Elem", jhs: "JHS", shs: "SHS", college: "College" };

// ─── Pure helpers (tested in notify.test.ts) ─────────────────────────────────

/** Every area code inside `code`, including itself. */
export function insideCodes(code: string): Set<string> {
  const out = new Set([code]);
  for (const a of AREAS) if (a.parent_code && out.has(a.parent_code)) out.add(a.code);
  // areas.json is ordered parent-first, but loop again in case it isn't
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

function placeName(code: string): string {
  const a = BY_CODE.get(code);
  if (!a) return "your area";
  if (a.type === "national") return "Nationwide";
  if (a.type === "province") return `${a.name} (whole province)`;
  const m = a.name.match(/^City of (.+)$/);
  return m ? `${m[1]} City` : a.name;
}

function timeText(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function dayText(date: string, today: string): string {
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (date === today) return `Today, ${label}`;
  if (date === tomorrow.toISOString().slice(0, 10)) return `Tomorrow, ${label}`;
  return label;
}

export function buildMessage(a: AnnouncementRow, today: string) {
  const place = placeName(a.area_code);
  const levels = a.levels.includes("all") ? "All levels" : a.levels.map((l) => LEVEL_SHORT[l] ?? l).join(", ");
  const sector = a.sector === "both" ? "public & private" : `${a.sector} schools`;

  let title: string;
  if (a.kind === "resumption") title = `Classes resume — ${place}`;
  else if (a.kind === "holiday") title = `Walang pasok — ${place}`;
  else if (a.kind === "work_suspension") title = `Government work suspended — ${place}`;
  else if (a.f2f_only) title = `No face-to-face classes — ${place}`;
  else if (a.starts_at) title = `Walang pasok from ${timeText(a.starts_at)} — ${place}`;
  else if (!a.levels.includes("all")) title = `Classes suspended (${levels}) — ${place}`;
  else title = `Walang pasok — ${place}`;

  const parts = [dayText(a.date_covered, today)];
  if (a.kind === "holiday") parts.push("Non-working day");
  else if (a.kind !== "work_suspension") parts.push(`${levels}, ${sector}`);
  if (a.reason) parts.push(a.reason.charAt(0).toUpperCase() + a.reason.slice(1));

  return { title, body: parts.join(" · "), url: "/", tag: `${a.area_code}-${a.date_covered}` };
}

export type SignalRow = { area_code: string; level: number; storm: string | null; bulletin_no: string | null; issued: string | null; notified_level: number };

/** "Wind Signal No. 2 raised — San Fernando City" (a weather alert, not a suspension). */
export function buildSignalMessage(s: SignalRow) {
  const parts = [s.storm ?? "Tropical cyclone", s.issued ? `PAGASA, issued ${s.issued}` : "PAGASA", "Watch for class suspension announcements."];
  return {
    title: `Wind Signal No. ${s.level} raised — ${placeName(s.area_code)}`,
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

  const { data: subs, error: subErr } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, area_code, levels").limit(5000);
  if (subErr) throw new Error(`Loading subscriptions: ${subErr.message}`);

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
    const payload = JSON.stringify(buildMessage(a, today));
    for (const s of (subs ?? []) as SubscriptionRow[]) if (!gone.has(s.id) && wantsIt(s, a)) await push(s, payload);
    await db.from("announcements").update({ notified_at: new Date().toISOString() }).eq("id", a.id);
  }

  for (const sig of signals) {
    const payload = JSON.stringify(buildSignalMessage(sig));
    for (const s of (subs ?? []) as SubscriptionRow[]) if (!gone.has(s.id) && s.area_code === sig.area_code) await push(s, payload);
    await db.from("wind_signals").update({ notified_level: sig.level }).eq("area_code", sig.area_code);
  }

  if (gone.size) await db.from("push_subscriptions").delete().in("id", [...gone]);
  return { sent, skipped: null };
}
