// Saves scanner results to Supabase. Needs SUPABASE_SERVICE_ROLE_KEY (server only, never in the browser).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Announcement } from "./classify.ts";
import type { GmaArticle } from "./sources/gma.ts";

export function connect(): SupabaseClient {
  // Locally, read keys from .env.local. On GitHub Actions they come from repository secrets.
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // file not found — fine on GitHub Actions
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("your-project") || key.startsWith("your-")) {
    throw new Error("Missing Supabase keys. Fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getSource(db: SupabaseClient, url: string) {
  const { data, error } = await db.from("sources").select("id, name, is_official").eq("url", url).single();
  if (error) throw new Error(`Source not found (${url}). Did you run supabase/seed/0002_sources.sql? ${error.message}`);
  return data as { id: number; name: string; is_official: boolean };
}

/** Saves the article. Returns its id, and whether it changed since the last scan. */
export async function saveRawItem(db: SupabaseClient, sourceId: number, a: GmaArticle) {
  const { data: existing } = await db
    .from("raw_items").select("id, updated_hash")
    .eq("source_id", sourceId).eq("external_id", a.id).maybeSingle();
  if (existing && existing.updated_hash === a.modifiedAt) return { id: existing.id as number, changed: false };

  const { data, error } = await db.from("raw_items").upsert({
    source_id: sourceId,
    external_id: a.id,
    title: a.title,
    url: a.url,
    content: a.lines.map((l) => l.text).join("\n"),
    published_at: a.publishedAt,
    fetched_at: new Date().toISOString(),
    updated_hash: a.modifiedAt,
  }, { onConflict: "source_id,external_id" }).select("id").single();
  if (error) throw new Error(`Saving article ${a.id}: ${error.message}`);
  return { id: data.id as number, changed: true };
}

/** One row per place + day. Re-saving updates the row but keeps notified_at, so nobody is notified twice. */
export async function saveAnnouncements(
  db: SupabaseClient, rawItemId: number, source: { name: string; is_official: boolean }, articleUrl: string, list: Announcement[],
) {
  const rows = list.flatMap((a) => a.dates.map((date) => ({
    raw_item_id: rawItemId,
    area_code: a.areaCode,
    kind: a.kind,
    levels: a.levels === "all" ? ["all"] : a.levels,
    sector: a.sector,
    date_covered: date,
    starts_at: a.startsAt,
    f2f_only: a.f2fOnly,
    includes_work: a.includesWork,
    reason: a.reason,
    summary: a.summary,
    source_name: source.name,
    source_url: articleUrl,
    lgu_post_url: a.lguPostUrl,
    is_official: source.is_official,
    updated_at: new Date().toISOString(),
  })));
  if (rows.length === 0) return 0;
  const { error } = await db.from("announcements").upsert(rows, { onConflict: "area_code,date_covered,source_name" });
  if (error) throw new Error(`Saving announcements: ${error.message}`);
  return rows.length;
}

export async function markChecked(db: SupabaseClient, sourceId: number, error: string | null) {
  await db.from("sources").update({ last_checked_at: new Date().toISOString(), last_error: error }).eq("id", sourceId);
}
