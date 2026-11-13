// POST /api/report  { announcementId, reason, note? }  → saves a "Report a mistake" entry for the team to review.
// No personal information is stored.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const REASONS = new Set(["wrong_place", "wrong_date", "wrong_levels", "not_suspension", "other"]);

export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Reports aren't available yet — the database isn't connected." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const id = Number(body?.announcementId);
  const reason = body?.reason;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";

  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid announcement" }, { status: 400 });
  if (typeof reason !== "string" || !REASONS.has(reason)) return NextResponse.json({ error: "Invalid reason" }, { status: 400 });

  const { error } = await db.from("reports").insert({ announcement_id: id, reason, note: note || null });
  if (error) {
    // 23503 = the announcement doesn't exist
    const status = error.code === "23503" ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Announcement not found" : error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
