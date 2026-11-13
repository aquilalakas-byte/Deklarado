// Tests use real PAGASA bulletin text (scanner/fixtures) plus Pampanga examples in the same format.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import areasData from "../src/data/areas.json" with { type: "json" };
import type { Area } from "./classify.ts";
import { parseBulletin, parseIndex, townSignals } from "./sources/pagasa.ts";

const AREAS = areasData as Area[];
const PAMPANGA = AREAS.find((a) => a.code === "035400000")!;
const TOWNS = AREAS.filter((a) => a.parent_code === PAMPANGA.code);
const fixture = (name: string) => readFileSync(new URL(`./fixtures/pagasa-${name}.txt`, import.meta.url), "utf8");
const levelOf = (m: Map<string, number>, name: string) => m.get(TOWNS.find((t) => t.name === name)!.code);

test("real bulletin: Typhoon Rosal #10 (Batanes signal 2)", () => {
  const b = parseBulletin(fixture("rosal10"));
  assert.equal(b.storm, "Typhoon ROSAL (CHAMPI)");
  assert.equal(b.number, "10");
  assert.equal(b.issued, "5:00 PM, 22 October 2026");
  assert.equal(b.noSignal, false);
  assert.deepEqual(b.areas.find((a) => a.place === "Batanes"), { level: 2, place: "Batanes", scope: "whole", towns: [] });
  const isabela = b.areas.find((a) => a.place === "Isabela")!;
  assert.equal(isabela.level, 1);
  assert.equal(isabela.scope, "part");
  assert.ok(isabela.towns.includes("Palanan"));
});

test("real bulletin: Maymay #6 (signal list runs across a page break)", () => {
  const b = parseBulletin(fixture("maymay6"));
  const tarlac = b.areas.find((a) => a.place === "Tarlac")!;
  assert.equal(tarlac.level, 1);
  assert.equal(tarlac.scope, "part");
  assert.equal(tarlac.towns.length, 12);
  assert.ok(b.areas.some((a) => a.place === "La Union" && a.level === 1 && a.scope === "rest"));
  assert.ok(b.areas.some((a) => a.place === "Aurora" && a.level === 1));
  // La Union's "City of San Fernando" must not leak into Pampanga
  assert.ok([...townSignals(b, PAMPANGA, TOWNS).values()].every((l) => l === 0));
});

test("real bulletin: final bulletin with no signal", () => {
  const b = parseBulletin(fixture("neneng9"));
  assert.equal(b.noSignal, true);
  assert.equal(b.number, "9F");
});

const pampangaBulletin = (areas: string) => `TROPICAL CYCLONE BULLETIN NR. 7
Typhoon SAMPLE
Issued at 11:00 AM, 01 November 2026
TROPICAL CYCLONE WIND SIGNALS (TCWS) IN EFFECT
TCWS No. Luzon Visayas Mindanao
${areas}
OTHER HAZARDS AFFECTING LAND AREAS`;

test("Pampanga: part under signal 2, rest under signal 1", () => {
  const b = parseBulletin(pampangaBulletin(`2
Wind threat:
Gale-force
winds
Tarlac, the northern portion of Pampanga (Magalang, Arayat, City of
Angeles, Mabalacat City)
- -
Warning lead time: 24 hours
1
Wind threat:
Strong
winds
Bataan, the rest of Pampanga, and Bulacan
- -
Warning lead time: 36 hours`));
  const m = townSignals(b, PAMPANGA, TOWNS);
  assert.equal(levelOf(m, "Magalang"), 2);
  assert.equal(levelOf(m, "City of Angeles"), 2);
  assert.equal(levelOf(m, "Mabalacat City"), 2);
  assert.equal(levelOf(m, "City of San Fernando"), 1);
  assert.equal(levelOf(m, "Lubao"), 1);
});

test("Pampanga: whole province", () => {
  const m = townSignals(parseBulletin(pampangaBulletin(`3
Wind threat:
Storm-force
winds
Pampanga, Bulacan, and Metro Manila
- -
Warning lead time: 18 hours`)), PAMPANGA, TOWNS);
  assert.ok([...m.values()].every((l) => l === 3));
});

test("PAGASA folder listing → newest bulletin first", () => {
  const html = `<a href="TCB%2310_rosal.pdf">TCB#10_rosal.pdf</a>   22-Oct-2026 09:01  668K
<a href="TCB%2311_rosal.pdf">TCB#11_rosal.pdf</a>   22-Oct-2026 15:05  600K
<a href="IWS%232_pilandok.pdf">IWS#2_pilandok.pdf</a>   30-Aug-2026 09:07  244K
<a href="TCB%239F_neneng.pdf">TCB#9F_neneng.pdf</a>   20-Aug-2026 09:00  300K`;
  const files = parseIndex(html);
  assert.equal(files.length, 3);
  assert.equal(files[0].name, "TCB#11_rosal.pdf");
  assert.equal(files[0].modifiedAt.toISOString(), "2026-10-22T15:05:00.000Z");
  assert.match(files[0].url, /TCB%2311_rosal\.pdf$/);
});

test("rules table is empty until DepEd publishes EO 130 thresholds → signals never create suspensions", async () => {
  const { SIGNAL_RULES, ruleFor } = await import("./rules.ts");
  const { ruleAnnouncements } = await import("./pagasa-scan.ts");
  assert.deepEqual(SIGNAL_RULES, {});
  assert.equal(ruleFor(3), null);
  const b = parseBulletin(pampangaBulletin(`2\nWind threat:\nGale-force\nwinds\nPampanga\n- -\nWarning lead time: 24 hours`));
  const levels = townSignals(b, PAMPANGA, TOWNS);
  assert.equal(ruleAnnouncements(levels, b, "2026-11-01").length, 0);
});

test("once rules are filled in, signals become automatic suspensions", async () => {
  const { SIGNAL_RULES, ruleFor } = await import("./rules.ts");
  const { ruleAnnouncements } = await import("./pagasa-scan.ts");
  SIGNAL_RULES[1] = { levels: ["kinder"] };
  SIGNAL_RULES[3] = { levels: "all" };
  try {
    assert.deepEqual(ruleFor(2), { levels: ["kinder"] }); // falls back to the highest rule below
    const b = parseBulletin(pampangaBulletin(`2\nWind threat:\nGale-force\nwinds\nthe northern portion of Pampanga (Magalang)\n- -\nWarning lead time: 24 hours`));
    const list = ruleAnnouncements(townSignals(b, PAMPANGA, TOWNS), b, "2026-11-01");
    assert.equal(list.length, 1);
    assert.equal(list[0].areaName, "Magalang");
    assert.deepEqual(list[0].levels, ["kinder"]);
    assert.match(list[0].reason!, /Wind Signal No\. 2 \(Typhoon SAMPLE\)/);
  } finally {
    delete SIGNAL_RULES[1];
    delete SIGNAL_RULES[3];
  }
});

test("wind signal notification text", async () => {
  const { buildSignalMessage } = await import("./notify.ts");
  const m = buildSignalMessage({ area_code: "035416000", level: 2, storm: "Typhoon SAMPLE", bulletin_no: "7", issued: "11:00 AM, 01 November 2026", notified_level: 0 });
  assert.equal(m.title, "Wind Signal No. 2 raised — San Fernando City");
  assert.equal(m.body, "Typhoon SAMPLE · PAGASA, issued 11:00 AM, 01 November 2026 · Watch for class suspension announcements.");
});
