// Reads RSS feeds from official websites (LGUs, DepEd). No extra libraries — RSS is simple XML.

import { decodeEntities, htmlToLines } from "../lib/html.ts";

// Some sites (e.g. Angeles City) refuse requests that don't look like a normal browser.
const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 DeklaradoScanner/1.0",
  // A normal browser Accept header. (Guagua's server rejects "application/rss+xml" with HTTP 415.)
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export type FeedItem = {
  id: string;          // guid or link
  title: string;
  link: string;
  publishedAt: string; // ISO
  text: string;        // plain text of the post (first ~2000 characters)
};

/**
 * LGU posts often use "fancy" Unicode letters copied from Facebook (𝐖𝐀𝐋𝐀𝐍𝐆 𝐏𝐀𝐒𝐎𝐊).
 * NFKC turns them back into normal letters so keyword rules can read them.
 */
export const plain = (s: string) => s.normalize("NFKC").replace(/[​-‍️]/g, "");

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const it = m[0];
    const title = plain(decodeEntities(tag(it, "title") ?? "")).replace(/\s+/g, " ").trim();
    const link = decodeEntities(tag(it, "link") ?? "").trim();
    const guid = decodeEntities(tag(it, "guid") ?? "").trim();
    const date = tag(it, "pubDate");
    const html = tag(it, "content:encoded") ?? tag(it, "description") ?? "";
    const publishedAt = date && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : null;
    if (!title || !publishedAt) continue;
    const text = plain(htmlToLines(html).map((l) => l.text).join("\n")).slice(0, 2000);
    items.push({ id: guid || link || title, title, link, publishedAt, text });
  }
  return items;
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`Feed ${url} → HTTP ${res.status}`);
  const body = await res.text();
  if (!/<rss|<feed/i.test(body.slice(0, 500))) throw new Error(`Feed ${url} did not return RSS`);
  return parseFeed(body);
}
