// Classifier for a single post from an OFFICIAL website (an LGU or DepEd).
//
// Unlike GMA's lists, an LGU post is about that LGU, so the place is known from the source.
// The rules are strict on purpose — a news article ABOUT suspension rules must not become a suspension.

import type { Announcement } from "./classify.ts";
import { parseLevels, parseSector, parseStartTime } from "./classify.ts";
import { parseDates } from "./lib/dates.ts";
import type { FeedItem } from "./sources/rss.ts";

// The post must clearly announce a suspension...
const SUSPENSION = /\b(walang pasok|suspen(?:sion|ded|dido|didong)\s+(?:ang\s+|of\s+)?(?:mga\s+)?(?:class(?:es)?|klase|face-to-face|in-person|onsite)|class(?:es)?\s+(?:are\s+|is\s+)?suspended|(?:class|klase)\s+suspension|kanselado ang (?:mga )?klase|no classes|cancell?ation of classes)\b/i;
// ...and must not be one of these
const NOT_AN_ANNOUNCEMENT = /\b(guidelines?|executive order|EO\s*\d+|DepEd Order|memorandum circular|policy|rules on|bid|procurement|hiring|job)\b/i;
const RESUMPTION = /\b(resum(e|ption) of (classes|face-to-face)|classes (will )?resume|tuloy ang (mga )?klase|may pasok na)\b/i;

const manilaDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Which day(s) the post is about: an explicit date, or "today"/"tomorrow" relative to when it was posted. */
export function postDates(text: string, publishedAt: string): string[] {
  const posted = manilaDate(publishedAt);
  const explicit = parseDates(text, Number(posted.slice(0, 4)))
    .filter((d) => d >= addDays(posted, -1) && d <= addDays(posted, 14)); // ignore dates far from the posting date
  if (explicit.length) return explicit;
  if (/\b(bukas|tomorrow)\b/i.test(text)) return [addDays(posted, 1)];
  if (/\b(ngayong araw|ngayon|today|this (morning|afternoon))\b/i.test(text)) return [posted];
  return []; // not sure which day → don't guess
}

export type PostSource = { areaCode: string; areaName: string; nationalOnly?: boolean };

export function classifyPost(item: FeedItem, src: PostSource): Announcement[] {
  const head = `${item.title}\n${item.text.slice(0, 800)}`;
  const resumed = RESUMPTION.test(head);
  if (!resumed && !SUSPENSION.test(head)) return [];
  if (NOT_AN_ANNOUNCEMENT.test(item.title)) return [];
  // DepEd's national feed: only nationwide suspensions count (local ones come from LGUs).
  if (src.nationalOnly && !/\b(nationwide|all public schools|buong bansa|entire country)\b/i.test(head)) return [];

  const dates = postDates(head, item.publishedAt);
  if (!dates.length) return [];

  return [{
    place: src.areaName,
    details: item.title,
    kind: resumed ? "resumption" : /\bnon-working\b/i.test(head) ? "holiday" : "class_suspension",
    levels: parseLevels(head),
    sector: parseSector(head),
    f2fOnly: /\b(face-to-face|f2f|in-person|onsite|on-site)\b/i.test(head) && !/\b(online|all) classes\b.*suspend/i.test(head),
    includesWork: /\b(government (offices|work|employees)|gov'?t (offices|work)|work in (the )?government|pasok sa (gobyerno|trabaho)|and work)\b/i.test(head),
    startsAt: parseStartTime(head),
    dates,
    reason: head.match(/\b(?:due to|because of|dahil sa|bunsod ng|dulot ng)\s+(?:the\s+)?([^.;\n)]+)/i)?.[1]?.trim().slice(0, 140) ?? null,
    areaCode: src.areaCode,
    areaName: src.areaName,
    summary: item.title,
    lguPostUrl: item.link || null,
  }];
}
