// The scanner. Runs every 3 hours on GitHub Actions.
//
//   npm run scan        → read all sources, classify, save to Supabase, send notifications
//   npm run scan:dry    → read all sources and classify, print results, save nothing
//   node scanner/run.ts --dry --debug   → also print every GMA list line for ANY place (to check the classifier)
//   node scanner/run.ts --dry --days 14 → look further back (default: 3 days)
//   node scanner/run.ts --only gma|pagasa|rss → run just one stage
//
// Each source is a separate stage: if one website is down, the others still run.

import type { SupabaseClient } from "@supabase/supabase-js";
import areas from "../src/data/areas.json" with { type: "json" };
import { classifyArticle, parseLine, type Announcement, type Area } from "./classify.ts";
import { classifyPost } from "./classify-post.ts";
import { scanPagasa } from "./pagasa-scan.ts";
import { fetchRecentGmaArticles, GMA_LIST_URL } from "./sources/gma.ts";
import { RSS_SOURCES } from "./sources/registry.ts";
import { fetchFeed } from "./sources/rss.ts";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const DEBUG = args.includes("--debug");
const DAYS = Number(args[args.indexOf("--days") + 1]) || 3;
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const AREAS = areas as Area[];
type DB = typeof import("./db.ts");

const describe = (a: Announcement) =>
  `${a.areaName}: ${a.kind}, levels=${a.levels === "all" ? "all" : a.levels.join("+")}, ${a.sector}${a.f2fOnly ? ", face-to-face only" : ""}${a.startsAt ? `, from ${a.startsAt}` : ""} (${a.dates.join(", ")})`;

// ─── Stage: GMA News ─────────────────────────────────────────────────────────

async function scanGma(client: SupabaseClient | null, db: DB | null) {
  console.log(`Reading GMA Walang Pasok articles from the last ${DAYS} day(s)...`);
  const source = client && db ? await db.getSource(client, GMA_LIST_URL) : null;
  let found = 0;
  try {
    const articles = await fetchRecentGmaArticles(DAYS);
    console.log(`  Found ${articles.length} suspension article(s).`);
    for (const article of articles) {
      const { announcements, articleDates } = classifyArticle(article, AREAS);
      console.log(`  ▶ ${article.title}  [${articleDates.join(", ")}]`);
      if (DEBUG) {
        for (const line of article.lines) {
          const p = parseLine(line.text);
          if (p && !/refresh/i.test(p.place)) console.log(`      · ${p.place.padEnd(32)} ${p.kind.padEnd(16)} levels=${p.levels === "all" ? "all" : p.levels.join("+")} sector=${p.sector}${p.f2fOnly ? " f2f-only" : ""}${p.startsAt ? ` from ${p.startsAt}` : ""}${p.includesWork ? " +work" : ""}`);
        }
      }
      for (const a of announcements) console.log(`    ✔ ${describe(a)}`);
      found += announcements.length;
      if (client && db && source) {
        const raw = await db.saveRawItem(client, source.id, article);
        if (raw.changed) await db.saveAnnouncements(client, raw.id, source, article.url, announcements);
      }
    }
    if (client && db && source) await db.markChecked(client, source.id, null);
  } catch (e) {
    if (client && db && source) await db.markChecked(client, source.id, (e as Error).message);
    throw e;
  }
  console.log(`  ${found} Pampanga announcement(s) from GMA.`);
}

// ─── Stage: official websites (RSS) ──────────────────────────────────────────

async function scanRss(client: SupabaseClient | null, db: DB | null) {
  console.log("Reading official websites (RSS)...");
  const cutoff = Date.now() - DAYS * 24 * 3600_000;
  const failures: string[] = [];
  for (const src of RSS_SOURCES) {
    const source = client && db ? await db.getSource(client, src.url) : null;
    try {
      const items = (await fetchFeed(src.url)).filter((i) => new Date(i.publishedAt).getTime() >= cutoff);
      let found = 0;
      for (const item of items) {
        const list = classifyPost(item, src);
        for (const a of list) console.log(`    ✔ ${describe(a)} — "${item.title}"`);
        found += list.length;
        if (list.length && client && db && source) {
          const raw = await db.saveRawItem(client, source.id, {
            id: item.id, title: item.title, url: item.link, publishedAt: item.publishedAt, modifiedAt: item.publishedAt,
            lines: item.text.split("\n").map((text) => ({ text, link: null, isListItem: false })),
          });
          if (raw.changed) await db.saveAnnouncements(client, raw.id, source, item.link, list);
        }
      }
      console.log(`  ${src.name}: ${items.length} recent post(s), ${found} suspension(s)`);
      if (client && db && source) await db.markChecked(client, source.id, null);
    } catch (e) {
      const msg = (e as Error).message;
      console.warn(`  ! ${src.name}: ${msg}`);
      failures.push(src.name);
      if (client && db && source) await db.markChecked(client, source.id, msg);
    }
  }
  // One website being down is normal; only fail the stage if ALL of them failed.
  if (failures.length === RSS_SOURCES.length) throw new Error("all websites failed");
}

// ─── Run all stages ──────────────────────────────────────────────────────────

async function main() {
  console.log(`Deklarado scanner — ${new Date().toISOString()} ${DRY ? "(dry run, nothing saved)" : ""}\n`);
  const db = DRY ? null : await import("./db.ts");
  const client = db?.connect() ?? null;

  const stages: [string, () => Promise<void>][] = [
    ["gma", () => scanGma(client, db)],
    ["pagasa", () => scanPagasa(client)],
    ["rss", () => scanRss(client, db)],
  ];
  const failed: string[] = [];
  for (const [name, run] of stages) {
    if (ONLY && ONLY !== name) continue;
    try {
      await run();
    } catch (e) {
      console.error(`  ✖ ${name} stage failed: ${(e as Error).message}`);
      failed.push(name);
    }
    console.log();
  }

  // Alert subscribers about anything new (including items saved by earlier runs that weren't sent yet).
  if (client) {
    const { sendNotifications } = await import("./notify.ts");
    const result = await sendNotifications(client);
    console.log(result.skipped ? `Notifications: ${result.skipped}` : `Notifications: ${result.sent} sent.`);
  }

  if (failed.length) {
    console.error(`Finished with problems in: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error("Scanner failed:", e.message);
  process.exit(1);
});
