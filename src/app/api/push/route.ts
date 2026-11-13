// POST   /api/push  { subscription, areaCode, levels }  → save or update this browser's subscription
// DELETE /api/push  { endpoint }                        → remove it
//
// Subscriptions are stored with the service role key; the table has no public access.

import { NextResponse, type NextRequest } from "next/server";
import { getArea } from "@/lib/areas";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { LEVELS } from "@/lib/types";

const LEVEL_IDS = new Set<string>(LEVELS.map((l) => l.id));

function notReady() {
  return NextResponse.json(
    { error: "Notifications aren't available yet — the database isn't connected." },
    { status: 503 },
  );
}

const isPushEndpoint = (s: unknown): s is string => {
  if (typeof s !== "string" || s.length > 1000) return false;
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
};

export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return notReady();

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  const areaCode = body?.areaCode;
  const levels: unknown = body?.levels;

  if (!sub || !isPushEndpoint(sub.endpoint) || typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const area = getArea(typeof areaCode === "string" ? areaCode : null);
  if (!area || (area.type !== "city" && area.type !== "municipality")) {
    return NextResponse.json({ error: "Choose a city or town first" }, { status: 400 });
  }
  const cleanLevels = Array.isArray(levels) ? levels.filter((l): l is string => typeof l === "string" && LEVEL_IDS.has(l)) : [];

  const row = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh.slice(0, 200),
    auth: sub.keys.auth.slice(0, 100),
    area_code: area.code,
    levels: cleanLevels.length ? cleanLevels : ["all"],
    lang: body?.lang === "fil" ? "fil" : "en",
    remind_holidays: body?.remindHolidays !== false,
    remind_events: body?.remindEvents !== false,
  };
  let { error } = await db.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error && /remind_|column/i.test(error.message)) {
    // Migration 0004 not run yet — save without the reminder choices so notifications still work.
    const { remind_holidays: _h, remind_events: _e, ...basic } = row;
    void _h; void _e;
    ({ error } = await db.from("push_subscriptions").upsert(basic, { onConflict: "endpoint" }));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return notReady();
  const body = await req.json().catch(() => null);
  if (!isPushEndpoint(body?.endpoint)) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
