// Reads the date(s) covered from a headline like:
//   "WALANG PASOK: Class suspensions for Friday, Nov. 13, 2026"
//   "WALANG PASOK: Suspendidong klase sa Lunes, November. 9, 2026"
//   "WALANG PASOK: Class suspensions for November 16-18, 2026"
// Returns ISO dates ("2026-11-13"), or [] if none found.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  // Filipino spellings
  enero: 1, pebrero: 2, marso: 3, abril: 4, mayo: 5, hunyo: 6, hulyo: 7, agosto: 8,
  setyembre: 9, oktubre: 10, nobyembre: 11, disyembre: 12,
};

function monthNumber(word: string): number | undefined {
  const w = word.toLowerCase().replace(/\./g, "");
  return MONTHS[w] ?? MONTHS[w.slice(0, 3)];
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function parseDates(text: string, fallbackYear: number): string[] {
  // Month, day or day range, optional year.  e.g. "Nov. 13, 2026" / "November 16-18, 2026" / "November 16 to 18"
  const re = /([A-Za-z]{3,10})\.?\s+(\d{1,2})(?:\s*(?:-|–|to|hanggang)\s*(\d{1,2}))?(?:,?\s*(\d{4}))?/g;
  for (const m of text.matchAll(re)) {
    const month = monthNumber(m[1]);
    if (!month) continue;
    const start = Number(m[2]);
    const end = m[3] ? Number(m[3]) : start;
    const year = m[4] ? Number(m[4]) : fallbackYear;
    if (start < 1 || start > 31 || end < start || end > 31) continue;
    const out: string[] = [];
    for (let d = start; d <= end; d++) out.push(iso(year, month, d));
    return out;
  }
  return [];
}
