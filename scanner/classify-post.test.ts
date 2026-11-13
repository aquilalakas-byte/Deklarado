import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPost, postDates } from "./classify-post.ts";
import { parseFeed, plain, type FeedItem } from "./sources/rss.ts";

const LUBAO = { areaCode: "035408000", areaName: "Lubao" };
const DEPED = { areaCode: "000000000", areaName: "Philippines", nationalOnly: true };

/** Turns "WALANG PASOK" into Facebook-style bold letters, like real LGU posts. */
const bold = (s: string) => [...s].map((c) =>
  c >= "A" && c <= "Z" ? String.fromCodePoint(0x1d400 + c.charCodeAt(0) - 65)
  : c >= "a" && c <= "z" ? String.fromCodePoint(0x1d41a + c.charCodeAt(0) - 97) : c).join("");

// Posted 8:00 PM Philippine time on Nov 12
const item = (title: string, text = "", publishedAt = "2026-11-12T12:00:00Z"): FeedItem =>
  ({ id: title, title: plain(title), link: "https://lubao.gov.ph/post", publishedAt, text: plain(text) });

test("fancy Facebook letters become normal letters", () => {
  assert.equal(plain(bold("WALANG PASOK")), "WALANG PASOK");
});

test("LGU post: 'walang pasok bukas' → tomorrow, whole town", () => {
  const [a] = classifyPost(item(bold("WALANG PASOK BUKAS"), "Suspendido ang klase sa lahat ng antas, pampubliko at pribado, dahil sa malakas na ulan."), LUBAO);
  assert.equal(a.areaCode, "035408000");
  assert.deepEqual(a.dates, ["2026-11-13"]);
  assert.equal(a.levels, "all");
  assert.equal(a.sector, "both");
  assert.equal(a.reason, "malakas na ulan");
  assert.equal(a.lguPostUrl, "https://lubao.gov.ph/post");
});

test("LGU post with an explicit date and levels", () => {
  const [a] = classifyPost(item("Class suspension advisory", "Classes from Kinder to Grade 6 in public schools are suspended on November 14, 2026 starting 1 p.m."), LUBAO);
  assert.deepEqual(a.dates, ["2026-11-14"]);
  assert.deepEqual(a.levels, ["kinder", "elementary"]);
  assert.equal(a.sector, "public");
  assert.equal(a.startsAt, "13:00");
});

test("resumption post", () => {
  const [a] = classifyPost(item("Classes will resume tomorrow", "Tuloy ang klase bukas sa lahat ng paaralan."), LUBAO);
  assert.equal(a.kind, "resumption");
});

test("posts that are NOT suspension announcements", () => {
  assert.equal(classifyPost(item("WE ARE HIRING!"), LUBAO).length, 0);
  assert.equal(classifyPost(item("Projects to bid on November 23, 2026"), LUBAO).length, 0);
  assert.equal(classifyPost(item("New guidelines on class suspension under EO 130", "walang pasok rules explained"), LUBAO).length, 0);
  // suspension words but no day given → don't guess
  assert.equal(classifyPost(item("Walang pasok", "Abangan ang anunsyo."), LUBAO).length, 0);
});

test("DepEd feed: only nationwide suspensions count", () => {
  assert.equal(classifyPost(item("Flexible learning sa mga eskwelahan ibabatay sa local conditions sa bagong EO", "walang pasok"), DEPED).length, 0);
  assert.equal(classifyPost(item("Classes suspended in Cavite tomorrow"), DEPED).length, 0);
  const [a] = classifyPost(item("Suspension of classes nationwide on November 16-18", "All public schools, all levels."), DEPED);
  assert.deepEqual(a.dates, ["2026-11-16", "2026-11-17", "2026-11-18"]);
  assert.equal(a.areaCode, "000000000");
});

test("dates far from the posting date are ignored", () => {
  assert.deepEqual(postDates("Walang pasok noong March 3", "2026-11-12T12:00:00Z"), []);
});

test("RSS parsing", () => {
  const xml = `<rss><channel><title>Lubao</title>
<item><title>&#x1f4cc; ${bold("WALANG PASOK")}</title><link>https://lubao.gov.ph/a</link><guid>https://lubao.gov.ph/?p=1</guid>
<pubDate>Thu, 12 Nov 2026 12:00:00 +0000</pubDate><content:encoded><![CDATA[<p>Walang pasok <strong>bukas</strong>.</p>]]></content:encoded></item>
<item><title>No date</title><link>x</link></item>
</channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "📌 WALANG PASOK");
  assert.equal(items[0].text, "Walang pasok bukas .");
  assert.equal(items[0].id, "https://lubao.gov.ph/?p=1");
});
