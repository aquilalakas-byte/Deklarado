// PUT /api/my-events  { endpoint, events: [{ start, end, title, kind }] }
// Replaces this phone's private copy of its school-calendar events (used only for night-before reminders).
// The endpoint must belong to an existing notification subscription.

import { NextResponse, type NextRequest } from "next/server";
import { isValidDate } from "@/lib/dates";
import { supabaseAdmin } from "@/lib/supabaseServer";

const KINDS = new Set(["no_class", "exam", "event"]);

export async function PUT(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }
  const { data: sub } = await db.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint).maybeSingle();
  if (!sub) return NextResponse.json({ error: "Turn on notifications first" }, { status: 404 });

  const events = (Array.isArray(body?.events) ? body.events : []).slice(0, 300).flatMap((e: Record<string, unknown>) => {
    const start = typeof e.start === "string" ? e.start : null;
    const end = typeof e.end === "string" ? e.end : start;
    const title = typeof e.title === "string" ? e.title.trim().slice(0, 80) : "";
    const kind = typeof e.kind === "string" && KINDS.has(e.kind) ? e.kind : "event";
    if (!isValidDate(start) || !isValidDate(end) || !title) return [];
    return [{ endpoint, start_date: start, end_date: end < start ? start : end, title, kind }];
  });

  const del = await db.from("personal_events").delete().eq("endpoint", endpoint);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 502 });
  if (events.length) {
    const ins = await db.from("personal_events").insert(events);
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, saved: events.length });
}
