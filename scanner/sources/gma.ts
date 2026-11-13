// Reads GMA News' "Walang Pasok" articles.
//
// 1. The list comes from the same JSON feed GMA's own tracker page uses.
// 2. Each article's text comes from the structured data (JSON-LD "articleBody") in the page,
//    which is cleaner than scraping the visible page.

import { htmlToLines, type Line } from "../lib/html.ts";

export const GMA_LIST_URL =
  "https://data.gmanetwork.com/gno/widgets/grid_reverse_listing/keyword_walang_pasok/15.gz";
const GMA_BASE = "https://www.gmanetwork.com/news/";
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; DeklaradoScanner/1.0; capstone project)" };

export type GmaArticle = {
  id: string;
  title: string;
  url: string;
  publishedAt: string; // ISO
  modifiedAt: string;  // ISO — changes whenever GMA updates the list
  lines: Line[];
};

type ListItem = { id: string; title: string; article_url: string; publish_timestamp: string; type: string };

/** Only real suspension round-ups, not related news stories. */
function isSuspensionList(title: string): boolean {
  return /walang pasok/i.test(title) && /(suspen|non-working|walang pasok sa)/i.test(title);
}

export async function fetchGmaList(): Promise<ListItem[]> {
  const res = await fetch(GMA_LIST_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`GMA list → HTTP ${res.status}`);
  const json = (await res.json()) as { data?: ListItem[] };
  if (!Array.isArray(json.data)) throw new Error("GMA list: unexpected format (no data array)");
  return json.data.filter((it) => it.type === "story" && isSuspensionList(it.title));
}

export async function fetchGmaArticle(item: ListItem): Promise<GmaArticle> {
  const url = GMA_BASE + item.article_url;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GMA article ${item.id} → HTTP ${res.status}`);
  const html = await res.text();

  let body: string | null = null;
  let modified: string | null = null;
  let published: string | null = null;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      for (const obj of Array.isArray(data) ? data : [data]) {
        if (obj?.articleBody) {
          body = obj.articleBody;
          modified = obj.dateModified ?? null;
          published = obj.datePublished ?? null;
        }
      }
    } catch {
      // ignore broken JSON blocks
    }
  }
  if (!body) throw new Error(`GMA article ${item.id}: no articleBody found`);

  // GMA's list timestamps are Philippine time without a zone marker.
  const listTime = new Date(item.publish_timestamp.replace(" ", "T") + "+08:00").toISOString();
  return {
    id: item.id,
    title: item.title.trim(),
    url,
    publishedAt: published ? new Date(published).toISOString() : listTime,
    modifiedAt: modified ? new Date(modified).toISOString() : listTime,
    lines: htmlToLines(body),
  };
}

/** Articles published in the last `days` days, newest first. */
export async function fetchRecentGmaArticles(days = 3): Promise<GmaArticle[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const items = (await fetchGmaList()).filter(
    (it) => new Date(it.publish_timestamp.replace(" ", "T") + "+08:00").getTime() >= cutoff,
  );
  const articles: GmaArticle[] = [];
  for (const it of items) {
    try {
      articles.push(await fetchGmaArticle(it));
    } catch (e) {
      console.warn(`  ! skipped ${it.id}: ${(e as Error).message}`);
    }
  }
  return articles;
}
