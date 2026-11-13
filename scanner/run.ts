// The scanner. Runs every 3 hours on GitHub Actions.
//
//   npm run scan        → read GMA, classify, save to Supabase
//   npm run scan:dry    → read GMA and classify, print results, save nothing
//   node scanner/run.ts --dry --debug   → also print every list line for ANY place (to check the classifier)
//   node scanner/run.ts --dry --days 14 → look further back (default: 3 days)

import areas from "../src/data/areas.json" with { type: "json" };
import { classifyArticle, parseLine, type Area } from "./classify.ts";
import { fetchRecentGmaArticles, GMA_LIST_URL } from "./sources/gma.ts";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const DEBUG = args.includes("--debug");
const DAYS = Number(args[args.indexOf("--days") + 1]) || 3;

const AREAS = areas as Area[];

async function main() {
  console.log(`Deklarado scanner — ${new Date().toISOString()} ${DRY ? "(dry run, nothing saved)" : ""}`);
  console.log(`Reading GMA Walang Pasok articles from the last ${DAYS} day(s)...`);

  const db = DRY ? null : await import("./db.ts");
  const client = db?.connect();
  const source = client && db ? await db.getSource(client, GMA_LIST_URL) : null;

  let found = 0;
  let saved = 0;
  try {
    const articles = await fetchRecentGmaArticles(DAYS);
    console.log(`Found ${articles.length} suspension article(s).\n`);

    for (const article of articles) {
      const { announcements, articleDates } = classifyArticle(article, AREAS);
      console.log(`▶ ${article.title}`);
      console.log(`  dates: ${articleDates.join(", ")} · updated ${article.modifiedAt}`);

      if (DEBUG) {
        for (const line of article.lines) {
          const p = parseLine(line.text);
          if (p && !/refresh/i.test(p.place)) console.log(`    · ${p.place.padEnd(32)} ${p.kind.padEnd(16)} levels=${p.levels === "all" ? "all" : p.levels.join("+")} sector=${p.sector}${p.f2fOnly ? " f2f-only" : ""}${p.startsAt ? ` from ${p.startsAt}` : ""}${p.includesWork ? " +work" : ""}`);
        }
      }

      for (const a of announcements) {
        console.log(`  ✔ ${a.areaName}: ${a.kind}, levels=${a.levels === "all" ? "all" : a.levels.join("+")}, ${a.sector}${a.f2fOnly ? ", face-to-face only" : ""}${a.startsAt ? `, from ${a.startsAt}` : ""} (${a.dates.join(", ")})`);
      }
      if (announcements.length === 0) console.log("  (no Pampanga areas in this article)");
      found += announcements.length;

      if (client && db && source) {
        const raw = await db.saveRawItem(client, source.id, article);
        if (raw.changed) saved += await db.saveAnnouncements(client, raw.id, source, article.url, announcements);
        else console.log("  (unchanged since last scan)");
      }
      console.log();
    }
    if (client && db && source) await db.markChecked(client, source.id, null);
  } catch (e) {
    if (client && db && source) await db.markChecked(client, source.id, (e as Error).message);
    throw e;
  }

  console.log(`Done. ${found} Pampanga announcement(s) found${DRY ? "" : `, ${saved} row(s) saved`}.`);
}

main().catch((e) => {
  console.error("Scanner failed:", e.message);
  process.exit(1);
});
