// Scanner stage: PAGASA Wind Signals → wind_signals table (+ automatic suspensions if rules exist).

import type { SupabaseClient } from "@supabase/supabase-js";
import areasData from "../src/data/areas.json" with { type: "json" };
import type { Announcement, Area } from "./classify.ts";
import { RULES_SOURCE, ruleFor } from "./rules.ts";
import { fetchBulletinText, latestBulletinFile, PAGASA_INDEX_URL, parseBulletin, townSignals, type Bulletin, type BulletinFile } from "./sources/pagasa.ts";

const AREAS = areasData as Area[];

function manilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Signal level per town code for every province we cover. */
export function allTownSignals(b: Bulletin | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const prov of AREAS.filter((a) => a.type === "province")) {
    const towns = AREAS.filter((a) => a.parent_code === prov.code);
    const levels = b ? townSignals(b, prov, towns) : new Map(towns.map((t) => [t.code, 0]));
    for (const [code, level] of levels) out.set(code, level);
  }
  return out;
}

/** Turns signals into suspension announcements — only when scanner/rules.ts has rules (empty until DepEd publishes EO 130 thresholds). */
export function ruleAnnouncements(levels: Map<string, number>, b: Bulletin, date: string): Announcement[] {
  const out: Announcement[] = [];
  for (const [code, level] of levels) {
    const rule = level > 0 ? ruleFor(level) : null;
    const area = AREAS.find((a) => a.code === code);
    if (!rule || !area) continue;
    const summary = `PAGASA Wind Signal No. ${level} in effect — automatic suspension${RULES_SOURCE ? ` under ${RULES_SOURCE}` : ""}`;
    out.push({
      place: area.name, details: summary, kind: "class_suspension", levels: rule.levels, sector: "both",
      f2fOnly: !!rule.f2fOnly, includesWork: false, startsAt: null, dates: [date],
      reason: `Wind Signal No. ${level}${b.storm ? ` (${b.storm})` : ""}`,
      areaCode: code, areaName: area.name, summary, lguPostUrl: null,
    });
  }
  return out;
}

export async function scanPagasa(client: SupabaseClient | null) {
  console.log("Reading PAGASA tropical cyclone bulletins...");
  let file: BulletinFile | null = null;
  let bulletin: Bulletin | null = null;
  file = await latestBulletinFile();
  if (file) bulletin = parseBulletin(await fetchBulletinText(file.url));

  const levels = allTownSignals(bulletin && !bulletin.noSignal ? bulletin : null);
  const raised = [...levels].filter(([, l]) => l > 0);
  if (!file) console.log("  No active tropical cyclone bulletin.");
  else console.log(`  ${bulletin?.storm ?? file.name} · bulletin #${bulletin?.number} · issued ${bulletin?.issued}`);
  for (const [code, level] of raised) console.log(`  ⚑ Signal No. ${level}: ${AREAS.find((a) => a.code === code)?.name}`);
  if (file && raised.length === 0) console.log("  No wind signal in our areas.");

  if (!client) return;
  const db = await import("./db.ts");
  const source = await db.getSource(client, PAGASA_INDEX_URL);
  try {
    const now = new Date().toISOString();
    const rows = [...levels].map(([area_code, level]) => ({
      area_code, level,
      storm: level ? bulletin?.storm ?? null : null,
      bulletin_no: level ? bulletin?.number ?? null : null,
      issued: level ? bulletin?.issued ?? null : null,
      bulletin_url: level ? file?.url ?? null : null,
      updated_at: now,
    }));
    const { error } = await client.from("wind_signals").upsert(rows, { onConflict: "area_code" });
    if (error) throw new Error(`Saving wind signals: ${error.message}`);

    const auto = file && bulletin ? ruleAnnouncements(levels, bulletin, manilaToday()) : [];
    if (auto.length && file && bulletin) {
      const raw = await db.saveRawItem(client, source.id, {
        id: file.name, title: `${bulletin.storm ?? "Tropical cyclone"} — bulletin #${bulletin.number}`, url: file.url,
        publishedAt: file.modifiedAt.toISOString(), modifiedAt: file.modifiedAt.toISOString(),
        lines: bulletin.areas.map((a) => ({ text: `Signal ${a.level}: ${a.place}${a.towns.length ? ` (${a.towns.join(", ")})` : ""}`, link: null, isListItem: false })),
      });
      const saved = await db.saveAnnouncements(client, raw.id, source, file.url, auto);
      console.log(`  ${saved} automatic suspension row(s) saved from signal rules.`);
    }
    await db.markChecked(client, source.id, null);
  } catch (e) {
    await db.markChecked(client, source.id, (e as Error).message);
    throw e;
  }
}
