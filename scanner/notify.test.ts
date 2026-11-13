import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessage, wantsIt, type AnnouncementRow } from "./notify.ts";

const SAN_FERNANDO = "035416000";
const ANGELES = "035401000";
const PAMPANGA = "035400000";
const NATIONAL = "000000000";

const ann = (p: Partial<AnnouncementRow>): AnnouncementRow => ({
  id: 1, area_code: SAN_FERNANDO, kind: "class_suspension", levels: ["all"], sector: "both",
  date_covered: "2026-11-13", starts_at: null, f2f_only: false, reason: null, ...p,
});

test("who gets the alert: town, province, nationwide", () => {
  const sfUser = { area_code: SAN_FERNANDO, levels: ["all"] };
  const angelesUser = { area_code: ANGELES, levels: ["all"] };
  assert.equal(wantsIt(sfUser, ann({ area_code: SAN_FERNANDO })), true);
  assert.equal(wantsIt(angelesUser, ann({ area_code: SAN_FERNANDO })), false);
  assert.equal(wantsIt(angelesUser, ann({ area_code: PAMPANGA })), true);
  assert.equal(wantsIt(angelesUser, ann({ area_code: NATIONAL })), true);
});

test("levels must match", () => {
  const collegeOnly = { area_code: SAN_FERNANDO, levels: ["college"] };
  assert.equal(wantsIt(collegeOnly, ann({ levels: ["kinder", "elementary"] })), false);
  assert.equal(wantsIt(collegeOnly, ann({ levels: ["college"] })), true);
  assert.equal(wantsIt(collegeOnly, ann({ levels: ["all"] })), true);
  assert.equal(wantsIt({ area_code: SAN_FERNANDO, levels: ["all"] }, ann({ levels: ["kinder"] })), true);
});

test("notification text", () => {
  const today = "2026-11-13";
  const m = buildMessage(ann({ reason: "typhoon signal no. 2" }), today);
  assert.equal(m.title, "Walang pasok — San Fernando City");
  assert.equal(m.body, "Today, Fri, Nov 13 · All levels, public & private · Typhoon signal no. 2");

  assert.equal(buildMessage(ann({ area_code: PAMPANGA, levels: ["kinder", "elementary"], sector: "public", date_covered: "2026-11-14" }), today).title,
    "Classes suspended (Kinder, Elem) — Pampanga (whole province)");
  assert.match(buildMessage(ann({ date_covered: "2026-11-14" }), today).body, /^Tomorrow, Sat, Nov 14/);
  assert.equal(buildMessage(ann({ starts_at: "13:00:00", area_code: "035408000" }), today).title, "Walang pasok from 1:00 PM — Lubao");
  assert.equal(buildMessage(ann({ f2f_only: true, area_code: ANGELES }), today).title, "No face-to-face classes — Angeles City");
  assert.equal(buildMessage(ann({ kind: "holiday", area_code: NATIONAL }), today).title, "Walang pasok — Nationwide");
});

test("notifications in Filipino", async () => {
  const { buildSignalMessage } = await import("./notify.ts");
  const today = "2026-11-13";
  const m = buildMessage(ann({ reason: "malakas na ulan" }), today, "fil");
  assert.equal(m.title, "Walang pasok — San Fernando City");
  assert.equal(m.body, "Ngayon, Biy, Nob 13 · Lahat ng antas, pampubliko at pribado · Malakas na ulan");
  assert.equal(buildMessage(ann({ area_code: PAMPANGA, levels: ["kinder"], date_covered: "2026-11-14" }), today, "fil").title,
    "Suspendido ang klase (Kinder) — Pampanga (buong probinsya)");
  assert.equal(buildMessage(ann({ starts_at: "13:00:00", area_code: "035408000" }), today, "fil").title, "Walang pasok simula 1:00 PM — Lubao");
  assert.equal(buildMessage(ann({ kind: "resumption" }), today, "fil").title, "Tuloy ang klase — San Fernando City");
  assert.equal(buildSignalMessage({ area_code: "035416000", level: 2, storm: null, bulletin_no: null, issued: null, notified_level: 0 }, "fil").title,
    "Nakataas ang Wind Signal No. 2 — San Fernando City");
  // unknown or missing language → English
  assert.equal(buildMessage(ann({}), today, null).body, "Today, Fri, Nov 13 · All levels, public & private");
});
