// Reads PAGASA Tropical Cyclone Bulletins (TCB) and works out the Wind Signal (TCWS) for each town.
//
// PAGASA publishes bulletins as PDFs in a public folder. We take the newest one, extract its text,
// and read the "TROPICAL CYCLONE WIND SIGNALS (TCWS) IN EFFECT" section, which looks like:
//
//   2
//   Wind threat:
//   Gale-force
//   winds
//   Ilocos Sur, the northern portion of La Union (Luna, Caba, ...), the rest of Pangasinan
//   - -
//   Warning lead time: 24 hours
//
// NOTE: a signal is a WEATHER ALERT, not a class suspension. Since Executive Order 130 (Oct 2026),
// automatic suspensions follow thresholds that DepEd will publish — see scanner/rules.ts.

import { norm, type Area } from "../classify.ts";

export const PAGASA_INDEX_URL = "https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/";
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; DeklaradoScanner/1.0; capstone project)" };
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export type SignalArea = {
  level: number;                     // 1–5
  place: string;                     // province or island group as written, e.g. "Tarlac"
  scope: "whole" | "part" | "rest";  // whole province / listed towns only / towns not listed elsewhere
  towns: string[];                   // for "part": the towns in brackets
};

export type Bulletin = {
  storm: string | null;      // "Typhoon ROSAL (CHAMPI)"
  number: string | null;     // "10", "9F" (F = final)
  issued: string | null;     // "5:00 PM, 22 October 2026"
  noSignal: boolean;         // "No Wind Signal is currently hoisted"
  areas: SignalArea[];
};

// ─── Finding the newest bulletin ─────────────────────────────────────────────

export type BulletinFile = { name: string; url: string; modifiedAt: Date };

/** Lists TCB PDFs in PAGASA's public folder (newest first). Times in the listing are UTC. */
export function parseIndex(html: string): BulletinFile[] {
  const out: BulletinFile[] = [];
  const re = /href="(TCB(?:%23|#)[0-9]+F?_[a-z]+\.pdf)"[^>]*>[^<]*<\/a>\s+(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2})/g;
  for (const m of html.matchAll(re)) {
    const month = MONTHS[m[3].toLowerCase()];
    if (month === undefined) continue;
    out.push({
      name: decodeURIComponent(m[1]),
      url: PAGASA_INDEX_URL + m[1].replace("#", "%23"),
      modifiedAt: new Date(Date.UTC(Number(m[4]), month, Number(m[2]), Number(m[5]), Number(m[6]))),
    });
  }
  return out.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

/** The newest bulletin if it was issued in the last `maxAgeHours` hours, else null (no active storm). */
export async function latestBulletinFile(maxAgeHours = 12): Promise<BulletinFile | null> {
  const res = await fetch(PAGASA_INDEX_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`PAGASA index → HTTP ${res.status}`);
  const newest = parseIndex(await res.text())[0];
  if (!newest) return null;
  return Date.now() - newest.modifiedAt.getTime() <= maxAgeHours * 3600_000 ? newest : null;
}

export async function fetchBulletinText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`PAGASA bulletin → HTTP ${res.status}`);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

// ─── Reading the bulletin text ───────────────────────────────────────────────

/** Split "A, the rest of B, and C (x, y)" into items — but not inside brackets. */
function splitItems(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let cur = "";
  const words = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < words.length; i++) {
    const ch = words[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && ch === ",") { items.push(cur); cur = ""; continue; }
    if (depth === 0 && words.startsWith(" and ", i)) { items.push(cur); cur = ""; i += 4; continue; }
    cur += ch;
  }
  items.push(cur);
  return items.map((s) => s.trim().replace(/^and\s+/i, "")).filter(Boolean);
}

function parseItem(item: string, level: number): SignalArea {
  const bracket = item.match(/\(([^)]*)\)\s*$/);
  const towns = bracket ? bracket[1].split(",").map((t) => t.trim()).filter(Boolean) : [];
  const base = item.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const scope: SignalArea["scope"] = /\brest of\b/i.test(base) ? "rest" : /\bportions?\b/i.test(base) && towns.length ? "part" : "whole";
  const place = base
    .replace(/^the\s+/i, "")
    .replace(/^rest of\s+(the\s+)?/i, "")
    .replace(/^.*?\bportions? of\s+(the\s+)?/i, "")
    .replace(/^(mainland|the mainland of)\s+/i, "")
    .trim();
  return { level, place, scope, towns: scope === "part" ? towns : [] };
}

export function parseBulletin(raw: string): Bulletin {
  const storm = raw.match(/TROPICAL CYCLONE BULLETIN NR\.\s*[0-9]+F?\s*\n\s*(.+)/)?.[1]?.trim() ?? null;
  const number = raw.match(/TROPICAL CYCLONE BULLETIN NR\.\s*([0-9]+F?)/)?.[1] ?? null;
  const issued = raw.match(/Issued at ([^\n]+)/)?.[1]?.trim() ?? null;

  // Remove the header repeated at the top of every page, so a signal list that runs onto the next page stays in one piece.
  const text = raw.replace(/TROPICAL CYCLONE BULLETIN NR\.[\s\S]*?Page \d+ of \d+\s*\n/g, "\n");
  const start = text.indexOf("WIND SIGNALS (TCWS) IN EFFECT");
  if (start < 0) return { storm, number, issued, noSignal: true, areas: [] };
  const rest = text.slice(start);
  const end = rest.search(/\n(OTHER HAZARDS|HAZARDS AFFECTING)/);
  const section = end > 0 ? rest.slice(0, end) : rest;
  if (/No Wind Signal is currently hoisted/i.test(section)) return { storm, number, issued, noSignal: true, areas: [] };

  const lines = section.split("\n").map((l) => l.trim());
  const areas: SignalArea[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^[1-5]$/.test(lines[i]) || !/^Wind threat/i.test(lines[i + 1] ?? "")) continue;
    const level = Number(lines[i]);
    let j = i + 1;
    while (j < lines.length && !/winds$/i.test(lines[j])) j++; // skip "Wind threat: / Gale-force / winds"
    const body: string[] = [];
    for (j++; j < lines.length && !/^Warning lead time/i.test(lines[j]); j++) {
      const l = lines[j].replace(/\s*-\s*-\s*$/, "").trim(); // drop the "- -" for empty Visayas/Mindanao columns
      if (l && l !== "-") body.push(l);
    }
    for (const item of splitItems(body.join(" "))) areas.push(parseItem(item, level));
    i = j;
  }
  return { storm, number, issued, noSignal: areas.length === 0, areas };
}

// ─── Signals for our towns ───────────────────────────────────────────────────

const townKey = (name: string) => norm(name).replace(/^city of /, "").replace(/ city$/, "");

/**
 * The signal level for each town of `province` (0 = none).
 * Higher signals are applied first; "the rest of X" covers towns not already given a higher signal.
 */
export function townSignals(b: Bulletin, province: Area, towns: Area[]): Map<string, number> {
  const levels = new Map(towns.map((t) => [t.code, 0]));
  const byKey = new Map<string, Area>();
  for (const t of towns) {
    byKey.set(townKey(t.name), t);
    for (const a of t.aliases) byKey.set(townKey(a.split(",")[0]), t);
  }
  const prov = norm(province.name);
  const mine = b.areas.filter((a) => norm(a.place) === prov).sort((x, y) => y.level - x.level);
  for (const a of mine) {
    if (a.scope === "part") {
      for (const name of a.towns) {
        const t = byKey.get(townKey(name));
        if (t && levels.get(t.code) === 0) levels.set(t.code, a.level);
      }
    } else {
      for (const t of towns) if (levels.get(t.code) === 0) levels.set(t.code, a.level);
    }
  }
  return levels;
}
