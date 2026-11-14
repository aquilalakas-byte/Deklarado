// Keyword classifier (no AI).
//
// Reads one line from a suspension list, e.g.
//   "San Fernando, Pampanga - all levels, public and private"
//   "Guagua - face-to-face classes suspended (Kinder to Grade 12, public)"
// and works out: which place, which levels, public/private, which time, and why.

import type { Line } from "./lib/html.ts";
import { parseDates } from "./lib/dates.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Level = "kinder" | "elementary" | "jhs" | "shs" | "college";
export const ALL_LEVELS: Level[] = ["kinder", "elementary", "jhs", "shs", "college"];

export type Kind = "class_suspension" | "work_suspension" | "holiday" | "resumption";

export type Area = { code: string; name: string; type: string; parent_code: string | null; aliases: string[] };

export type ParsedLine = {
  place: string;          // text before the separator, e.g. "San Fernando, Pampanga"
  details: string;        // text after it, e.g. "all levels, public and private"
  kind: Kind;
  levels: Level[] | "all";
  sector: "public" | "private" | "both";
  f2fOnly: boolean;
  includesWork: boolean;
  startsAt: string | null; // "HH:MM"
  dates: string[];         // dates mentioned in the line itself (often empty)
  reason: string | null;
};

export type Announcement = ParsedLine & {
  areaCode: string;
  areaName: string;
  summary: string;
  lguPostUrl: string | null;
};

// ─── Text helpers ────────────────────────────────────────────────────────────

/** Lowercase, expand Sta./Sto., drop punctuation — so "Sto. Tomas" and "Santo Tomas" match. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // ñ → n, é → e
    .replace(/\bsta\.?\s/g, "santa ")
    .replace(/\bsto\.?\s/g, "santo ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const hasWord = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `);

// "Place - details", "Place: details", "Place – details"
// "Place - details", "Place: details", "Place — details", "Place-- details"
// (a hyphen with no spaces, like "face-to-face", is NOT a separator)
const SEPARATOR = /\s*-{2,}\s*|\s+[-–—]\s+|:\s+|\s+[–—]|[–—]\s+/;

const SCHOOL_WORDS = /\b(university|college|colegio|school|academy|institute|high school|integrated|foundation)\b/i;

// ─── Line parsing (works for any place in the Philippines) ───────────────────

const LEVEL_PATTERNS: [Level, RegExp][] = [
  ["kinder", /\b(kinder\w*|pre-?school|pre-?elementary|day ?care|nursery|child development)\b/i],
  ["elementary", /\b(elementary|grade school|primary|elem)\b/i],
  ["jhs", /\b(junior high|jhs)\b/i],
  ["shs", /\b(senior high|shs)\b/i],
  ["college", /\b(college|tertiary|universit\w*|higher education|kolehiyo)\b/i],
];

function gradeToLevel(n: number): Level | null {
  if (n === 0) return "kinder";
  if (n >= 1 && n <= 6) return "elementary";
  if (n >= 7 && n <= 10) return "jhs";
  if (n >= 11 && n <= 12) return "shs";
  return null;
}

/** Find level mentions in order of appearance, with their position in the text. */
function levelMentions(text: string): { level: Level; at: number; end: number }[] {
  const found: { level: Level; at: number; end: number }[] = [];
  for (const [level, re] of LEVEL_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, "gi"))) found.push({ level, at: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(/\bgrades?\s*(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?/gi)) {
    const a = gradeToLevel(Number(m[1]));
    if (a) found.push({ level: a, at: m.index!, end: m.index! + m[0].length });
    if (m[2]) {
      const b = gradeToLevel(Number(m[2]));
      if (b) found.push({ level: b, at: m.index! + m[0].length - m[2].length, end: m.index! + m[0].length });
    }
  }
  // "secondary" / "high school" without junior/senior = both JHS and SHS
  for (const m of text.matchAll(/\b(secondary|high school)\b/gi)) {
    const before = text.slice(Math.max(0, m.index! - 8), m.index!).toLowerCase();
    if (before.includes("junior") || before.includes("senior")) continue;
    found.push({ level: "jhs", at: m.index!, end: m.index! + m[0].length });
    found.push({ level: "shs", at: m.index!, end: m.index! + m[0].length });
  }
  return found.sort((x, y) => x.at - y.at);
}

export function parseLevels(text: string): Level[] | "all" {
  if (/\b(all levels|all grade levels|lahat ng antas|lahat ng lebel|all schools)\b/i.test(text)) return "all";
  const mentions = levelMentions(text);
  if (mentions.length === 0) return "all"; // no level given = whole area
  const set = new Set<Level>(mentions.map((m) => m.level));

  // Ranges: "Kinder to Grade 12", "preschool hanggang senior high", "up to Grade 6"
  for (let i = 0; i < mentions.length - 1; i++) {
    const between = text.slice(mentions[i].end, mentions[i + 1].at);
    if (/^\s*(-|–|to|hanggang|until|through)\s*$/i.test(between)) {
      const a = ALL_LEVELS.indexOf(mentions[i].level);
      const b = ALL_LEVELS.indexOf(mentions[i + 1].level);
      for (let k = Math.min(a, b); k <= Math.max(a, b); k++) set.add(ALL_LEVELS[k]);
    }
  }
  const upTo = text.match(/\b(up to|until|hanggang)\s+(\w+(?:\s+\w+)?)/i);
  if (upTo) {
    const last = levelMentions(upTo[2])[0]?.level;
    if (last) for (let k = 0; k <= ALL_LEVELS.indexOf(last); k++) set.add(ALL_LEVELS[k]);
  }
  const levels = ALL_LEVELS.filter((l) => set.has(l));
  return levels.length === ALL_LEVELS.length ? "all" : levels;
}

export function parseSector(text: string): "public" | "private" | "both" {
  const pub = /\b(public|pampubliko|pampublikong)\b/i.test(text);
  const priv = /\b(private|pribado|pribadong)\b/i.test(text);
  if (pub && !priv) return "public";
  if (priv && !pub) return "private";
  return "both";
}

export function parseStartTime(text: string): string | null {
  const m = text.match(/\b(?:starting|simula|beginning|from|effective|mula)\s+(?:at\s+|alas[- ]?)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|nn|noon|ng tanghali|ng hapon)?/i);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] ?? "00";
    const suffix = (m[3] ?? "").toLowerCase().replace(/[\s.]/g, "");
    if ((suffix === "pm" || suffix.includes("hapon")) && h < 12) h += 12;
    if (suffix === "am" && h === 12) h = 0;
    if (h <= 23) return `${String(h).padStart(2, "0")}:${min}`;
  }
  if (/\b(afternoon (classes|session)|panghapon|hapon na klase)\b/i.test(text)) return "12:00";
  return null;
}

function parseReason(text: string): string | null {
  const m = text.match(/\b(?:due to|because of|dahil sa|bunsod ng|dulot ng)\s+(?:the\s+)?([^.;)]+)/i);
  return m ? m[1].trim().replace(/\s+/g, " ").slice(0, 140) : null;
}

export function parseLine(text: string): ParsedLine | null {
  const sep = text.match(SEPARATOR);
  if (!sep || sep.index === undefined) return null; // no "Place - details" shape → heading or prose
  const place = text.slice(0, sep.index).trim();
  const details = text.slice(sep.index + sep[0].length).trim();
  if (!place || !details) return null;
  if (place.split(/\s+/).length > 12) return null; // a long sentence, not a place

  const all = `${place} ${details}`;
  let kind: Kind = "class_suspension";
  if (/\b(resum\w*|tuloy ang klase|may pasok|lifted|bawi|cancel+ed the suspension)\b/i.test(details)) kind = "resumption";
  else if (/\b(non-working|holiday|walang pasok sa trabaho)\b/i.test(details)) kind = "holiday";
  else if (/\b(work|trabaho|government offices)\b/i.test(details) && !/\b(class\w*|klase|school\w*|paaralan|levels?)\b/i.test(details)) kind = "work_suspension";

  return {
    place,
    details,
    kind,
    levels: parseLevels(details),
    sector: parseSector(details),
    f2fOnly: /\b(face-to-face|face to face|f2f|in-person|onsite|on-site)\b/i.test(details) ||
      /\b(shift(ed)? to|lipat sa)\s+(online|modular|asynchronous|distance)\b/i.test(details),
    includesWork: kind === "holiday" || kind === "work_suspension" ||
      /\b(government (offices|work|employees)|gov'?t (offices|work)|work in (the )?government|pasok sa (gobyerno|trabaho)|and work)\b/i.test(all),
    startsAt: parseStartTime(details),
    dates: parseDates(details, new Date().getFullYear()),
    reason: parseReason(details),
  };
}

// ─── Matching to our areas (whole Philippines) ───────────────────────────────
//
// Each city/town can be written several ways ("San Fernando", "San Fernando City", "City of San Fernando",
// aliases like "CSFP"). A way of writing is UNIQUE when only one town in the country uses it and it is not
// also a province or region name. A unique name matches on its own; a shared name (there are 10 "San Jose"s)
// only matches when the town's province is written in the line or in the heading above it.

type NameForm = { text: string; unique: boolean };
type Matcher = { area: Area; forms: NameForm[]; context: string[] };
type Matchers = { towns: Matcher[]; provinces: Area[]; regions: { area: Area; names: string[] }[]; national: Area | undefined };

const stripCity = (s: string) => s.replace(/^city of /, "").replace(/ city$/, "");
const stripProvince = (s: string) => s.replace(/province( of)?/g, "").replace(/(entire|whole|buong|lalawigan ng)/g, "").replace(/s+/g, " ").trim();

const matcherCache = new WeakMap<Area[], Matchers>();

export function buildMatchers(areas: Area[]): Matchers {
  const cached = matcherCache.get(areas);
  if (cached) return cached;
  const byCode = new Map(areas.map((a) => [a.code, a]));
  const provinces = areas.filter((a) => a.type === "province");
  const regions = areas.filter((a) => a.type === "region").map((r) => ({ area: r, names: [r.name, ...r.aliases].map(norm) }));
  const reserved = new Set([...provinces.flatMap((p) => [norm(p.name), ...p.aliases.map((x) => stripProvince(norm(x)))]), ...regions.flatMap((r) => r.names)]);

  // Every way each town is written, then count how many towns share each one.
  const raw = areas.filter((a) => a.type === "city" || a.type === "municipality").map((a) => {
    const full = norm(a.name);
    const base = stripCity(full);
    const set = new Set([full, base, ...a.aliases.map((x) => norm(x.split(",")[0])), ...a.aliases.map((x) => stripCity(norm(x.split(",")[0])))]);
    if (a.type === "city") { set.add(`${base} city`); set.add(`city of ${base}`); }
    return { area: a, names: [...set].filter(Boolean) };
  });
  const count = new Map<string, number>();
  for (const t of raw) for (const n of t.names) count.set(n, (count.get(n) ?? 0) + 1);

  const towns: Matcher[] = raw.map(({ area, names }) => {
    const prov = byCode.get(area.parent_code ?? "");
    const context = prov ? [norm(prov.name), ...prov.aliases.map((x) => stripProvince(norm(x)))].filter(Boolean) : [];
    return { area, context, forms: names.map((text) => ({ text, unique: count.get(text) === 1 && !reserved.has(text) })) };
  });
  const m = { towns, provinces, regions, national: areas.find((a) => a.type === "national") };
  matcherCache.set(areas, m);
  return m;
}

export function matchAreas(place: string, heading: string, m: Matchers): Area[] {
  const p = norm(place);
  const ctx = ` ${p} ${norm(heading)} `;
  if (SCHOOL_WORDS.test(place)) return []; // a single school, not a whole town

  if (/(nationwide|buong bansa|all over the country|entire country)/.test(p) && m.national) return [m.national];

  // Whole province or region: the place part is just its name, e.g. "Pampanga" / "Province of Pampanga" / "Metro Manila"
  const stripped = stripProvince(p);
  for (const prov of m.provinces) {
    const names = [norm(prov.name), ...prov.aliases.map((x) => stripProvince(norm(x)))];
    if (names.includes(stripped)) return [prov];
  }
  for (const r of m.regions) if (r.names.includes(stripped)) return [r.area];

  // Town: match against the part before the first comma ("Talisay, Cebu" → "talisay"), so the province
  // name after the comma is never mistaken for a town (e.g. "Cebu" for Cebu City).
  const townPart = norm(place.split(",")[0]);
  let best: { area: Area; len: number }[] = [];
  for (const t of m.towns) {
    for (const f of t.forms) {
      if (!hasWord(townPart, f.text)) continue;
      if (!f.unique && !t.context.some((c) => ctx.includes(` ${c} `))) continue;
      best.push({ area: t.area, len: f.text.length });
    }
  }
  if (!best.length) return [];
  // "San Jose del Monte" also contains "San Jose" — keep only the longest (most specific) match.
  const longest = Math.max(...best.map((b) => b.len));
  best = best.filter((b) => b.len === longest);
  return [...new Map(best.map((b) => [b.area.code, b.area])).values()];
}

/** "Iloilo City", "City of San Fernando, Pampanga", "Lubao" → true.  "ALBAY", "PAMPANGA", "Metro Manila" → false. */
function isTownHeading(text: string, m: Matchers): boolean {
  if (/\b(city|municipality|bayan|lungsod)\b/i.test(text)) return true;
  return matchAreas(text, "", m).some((a) => a.type === "city" || a.type === "municipality");
}

// ─── Whole article → announcements ──────────────────────────────────────────

export type ArticleInput = { title: string; lines: Line[]; publishedAt: string };

export function classifyArticle(article: ArticleInput, areas: Area[]): { announcements: Announcement[]; articleDates: string[] } {
  const matchers = buildMatchers(areas);
  const year = new Date(article.publishedAt).getFullYear();
  let articleDates = parseDates(article.title, year);
  if (articleDates.length === 0) articleDates = [article.publishedAt.slice(0, 10)];
  const intro = article.lines.slice(0, 3).map((l) => l.text).join(" ");
  const articleReason = parseReason(intro);

  const out: Announcement[] = [];
  let heading = "";
  let headingIsTown = false; // true when the heading is a single city/town (e.g. "Iloilo City")
  for (const line of article.lines) {
    // Bullets under a town heading are individual schools in that town, not a town-wide suspension.
    // (Bullets under a province heading, or with no heading, are normal place entries.)
    if (line.isListItem && headingIsTown) continue;
    const parsed = parseLine(line.text);
    if (!parsed) {
      // A short line with no separator is a heading like "PAMPANGA" or "Iloilo City"
      if (!line.isListItem && line.text.split(/\s+/).length <= 5 && !/[.!?]$/.test(line.text)) {
        heading = line.text;
        headingIsTown = isTownHeading(line.text, matchers);
      }
      continue;
    }
    for (const area of matchAreas(parsed.place, heading, matchers)) {
      out.push({
        ...parsed,
        dates: parsed.dates.length ? parsed.dates : articleDates,
        reason: parsed.reason ?? articleReason,
        areaCode: area.code,
        areaName: area.name,
        summary: line.text,
        lguPostUrl: line.link && /facebook\.com|\.gov\.ph/i.test(line.link) ? line.link : null,
      });
    }
  }
  return { announcements: out, articleDates };
}
