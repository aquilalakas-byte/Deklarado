// Turns text read from a photo of a school calendar (OCR) into a list of events.
// No AI — date patterns + keyword rules. The user always reviews the result before saving.
//
// Handles lines like:
//   "Aug 12, 2026  Start of Classes"
//   "October 12-16 — Midterm Examinations"
//   "Dec 18, 2026 - Jan 4, 2027 : Christmas Break"
//   "11/30  Bonifacio Day (No Classes)"
//   "Midterm Exams .......... Oct 12-16"   (date at the end)
// (No imports with "@/" so the scanner's test runner can load this file too.)

export type EventKind = "no_class" | "exam" | "event";

export type ParsedEvent = {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD (same as start for one-day events)
  title: string;
  kind: EventKind;
  line: string;   // the original OCR line, shown in the review screen
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, enero: 1, feb: 2, february: 2, pebrero: 2, mar: 3, march: 3, marso: 3,
  apr: 4, april: 4, abril: 4, may: 5, mayo: 5, jun: 6, june: 6, hunyo: 6, jul: 7, july: 7, hulyo: 7,
  aug: 8, august: 8, agosto: 8, sep: 9, sept: 9, september: 9, setyembre: 9, oct: 10, october: 10, oktubre: 10,
  nov: 11, november: 11, nobyembre: 11, dec: 12, december: 12, disyembre: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** A date with no year: pick the year that puts it between ~2 months ago and ~10 months ahead (a school year). */
function guessYear(m: number, d: number, today: string): number {
  const ty = Number(today.slice(0, 4));
  for (const y of [ty, ty + 1, ty - 1]) {
    const t = Date.UTC(y, m - 1, d);
    const now = Date.parse(`${today}T00:00:00Z`);
    if (t >= now - 62 * 864e5 && t <= now + 304 * 864e5) return y;
  }
  return ty;
}

export function classify(title: string): EventKind {
  if (/\b(exam|exams|examination|examinations|midterms?|prelims?|pre-?finals?|finals?|quiz|assessment|pagsusulit)\b/i.test(title)) return "exam";
  if (/\b(holiday|break|vacation|bakasyon|no classes?|no class|walang (klase|pasok)|class suspension|suspension of classes|recess|day off|semestral|christmas|undas|all saints|all souls|new year)\b/i.test(title)) return "no_class";
  return "event";
}

type Found = { start: string; end: string; index: number; length: number };

/** Finds the first date or date range in a line. */
function findDate(line: string, today: string): Found | null {
  // 1) "Month D[, YYYY] - Month D[, YYYY]"  /  "Month D - D[, YYYY]"  /  "Month D[, YYYY]"
  const named = new RegExp(
    `\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?` +
    `(?:\\s*(?:-|–|—|to|until|hanggang)\\s*(?:(${MONTH_RE})\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?)?`,
    "i",
  );
  const m = line.match(named);
  if (m && m.index !== undefined) {
    const m1 = MONTHS[m[1].toLowerCase()];
    const d1 = Number(m[2]);
    const m2 = m[4] ? MONTHS[m[4].toLowerCase()] : m1;
    const d2 = m[5] ? Number(m[5]) : d1;
    let y2 = m[6] ? Number(m[6]) : m[3] ? Number(m[3]) : guessYear(m2, d2, today);
    let y1 = m[3] ? Number(m[3]) : y2;
    if (!m[3] && !m[6]) { y1 = guessYear(m1, d1, today); y2 = y1; }
    if (m2 < m1 && !m[6] && !m[3]) y2 = y1 + 1;           // "Dec 18 - Jan 4" crosses the new year
    if (m[3] && !m[6] && m2 < m1) y2 = y1 + 1;
    if (valid(y1, m1, d1) && valid(y2, m2, d2)) {
      const start = iso(y1, m1, d1);
      let end = iso(y2, m2, d2);
      if (end < start) end = start;
      return { start, end, index: m.index, length: m[0].length };
    }
  }
  // 2) Numeric "MM/DD[/YYYY]" (Philippine style: month first), optional "- MM/DD[/YYYY]"
  const num = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:-|–|to)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)?\b/);
  if (num && num.index !== undefined) {
    const yr = (s?: string) => (s ? (s.length === 2 ? 2000 + Number(s) : Number(s)) : undefined);
    const m1 = Number(num[1]); const d1 = Number(num[2]);
    const y1 = yr(num[3]) ?? guessYear(m1, d1, today);
    const m2 = num[4] ? Number(num[4]) : m1; const d2 = num[5] ? Number(num[5]) : d1;
    const y2 = yr(num[6]) ?? (m2 < m1 ? y1 + 1 : y1);
    if (valid(y1, m1, d1) && valid(y2, m2, d2)) {
      const start = iso(y1, m1, d1);
      let end = iso(y2, m2, d2);
      if (end < start) end = start;
      return { start, end, index: num.index, length: num[0].length };
    }
  }
  return null;
}

/** Remove separators, weekday names, dot leaders and table bars around the title. */
function cleanTitle(s: string): string {
  return s
    .replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b\.?/gi, " ")
    .replace(/\.{2,}|_{2,}|\|/g, " ")
    .replace(/^[\s\-–—:,;()]+|[\s\-–—:,;(]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseCalendarText(text: string, today: string): ParsedEvent[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: ParsedEvent[] = [];
  for (let i = 0; i < lines.length && out.length < 150; i++) {
    const line = lines[i];
    const found = findDate(line, today);
    if (!found) continue;
    let title = cleanTitle(line.slice(0, found.index) + " " + line.slice(found.index + found.length));
    let used = line;
    // Date alone on its line (common in table layouts) → the title is on the next line.
    if (title.length < 3 && lines[i + 1] && !findDate(lines[i + 1], today)) {
      title = cleanTitle(lines[i + 1]);
      used = `${line} ${lines[i + 1]}`;
      i++;
    }
    if (title.length < 3 || !/[a-z]/i.test(title)) continue;
    out.push({ start: found.start, end: found.end, title, kind: classify(title), line: used });
  }
  // Drop exact duplicates
  const seen = new Set<string>();
  return out.filter((e) => {
    const k = `${e.start}|${e.end}|${e.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
