// GET /api/announcements?areas=035416000,035400000&from=2026-11-01&to=2026-11-30
// Returns announcements for those areas in that date range.
// Uses demo data until the Supabase keys are set.

import { NextResponse, type NextRequest } from "next/server";
import { demoAnnouncements, demoSignals } from "@/lib/demo";
import { addDays, isValidDate, manilaToday } from "@/lib/dates";
import { supabaseReader } from "@/lib/supabaseServer";
import type { AnnouncementsResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const today = manilaToday();
  const from = isValidDate(p.get("from")) ? p.get("from")! : addDays(today, -30);
  const to = isValidDate(p.get("to")) ? p.get("to")! : addDays(today, 30);
  const areas = (p.get("areas") ?? "").split(",").filter((c) => /^\d{9}$/.test(c)).slice(0, 100);

  if (from > to || addDays(from, 400) < to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const db = supabaseReader();
  if (!db) {
    const announcements = demoAnnouncements(today).filter(
      (a) => (areas.length === 0 || areas.includes(a.area_code)) && a.date_covered >= from && a.date_covered <= to,
    );
    const body: AnnouncementsResponse = {
      demo: true,
      announcements,
      signals: demoSignals().filter((s) => areas.length === 0 || areas.includes(s.area_code)),
      sources: [{ name: "GMA News – Walang Pasok", last_checked_at: new Date(Date.now() - 50 * 60000).toISOString(), last_error: null }],
    };
    return NextResponse.json(body);
  }

  let query = db.from("announcements").select("*").gte("date_covered", from).lte("date_covered", to)
    .order("date_covered", { ascending: true }).order("updated_at", { ascending: false }).limit(500);
  if (areas.length) query = query.in("area_code", areas);
  let signalQuery = db.from("wind_signals").select("area_code, level, storm, bulletin_no, issued, bulletin_url").gt("level", 0);
  if (areas.length) signalQuery = signalQuery.in("area_code", areas);

  const [ann, sig, src] = await Promise.all([
    query,
    signalQuery,
    db.from("sources").select("name, last_checked_at, last_error").eq("active", true),
  ]);
  if (ann.error) return NextResponse.json({ error: ann.error.message }, { status: 502 });

  // wind_signals may not exist yet if migration 0002 wasn't run — the app still works without it.
  const body: AnnouncementsResponse = { demo: false, announcements: ann.data ?? [], signals: sig.error ? [] : sig.data ?? [], sources: src.data ?? [] };
  return NextResponse.json(body, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
}
