// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import areas from "../src/data/areas.json" with { type: "json" };
import { classifyArticle, parseLevels, parseSector, parseStartTime, parseLine, type Area } from "./classify.ts";
import { parseDates } from "./lib/dates.ts";
import { htmlToLines } from "./lib/html.ts";

const AREAS = areas as Area[];
const SAN_FERNANDO = "035416000";
const PAMPANGA = "035400000";

function run(html: string, title = "WALANG PASOK: Class suspensions for Friday, Nov. 13, 2026") {
  return classifyArticle({ title, lines: htmlToLines(html), publishedAt: "2026-11-12T15:00:00Z" }, AREAS).announcements;
}

test("dates from headlines", () => {
  assert.deepEqual(parseDates("WALANG PASOK: Class suspensions for Friday, Nov. 13, 2026", 2026), ["2026-11-13"]);
  assert.deepEqual(parseDates("Suspendidong klase sa Lunes, November. 9, 2026", 2026), ["2026-11-09"]);
  assert.deepEqual(parseDates("Class suspensions for November 16-18, 2026", 2026), ["2026-11-16", "2026-11-17", "2026-11-18"]);
  assert.deepEqual(parseDates("Mga suspendidong klase sa Martes, Nobyembre 3", 2026), ["2026-11-03"]);
});

test("levels", () => {
  assert.equal(parseLevels("all levels, public and private"), "all");
  assert.equal(parseLevels("classes suspended"), "all");
  assert.deepEqual(parseLevels("Kinder to Grade 6"), ["kinder", "elementary"]);
  assert.deepEqual(parseLevels("preschool to senior high school"), ["kinder", "elementary", "jhs", "shs"]);
  assert.deepEqual(parseLevels("public elementary and secondary schools"), ["elementary", "jhs", "shs"]);
  assert.deepEqual(parseLevels("Kindergarten only"), ["kinder"]);
  assert.deepEqual(parseLevels("college level"), ["college"]);
});

test("sector and time", () => {
  assert.equal(parseSector("all levels, public and private"), "both");
  assert.equal(parseSector("public schools only"), "public");
  assert.equal(parseSector("all levels"), "both");
  assert.equal(parseStartTime("starting 12 p.m. - all levels"), "12:00");
  assert.equal(parseStartTime("simula alas-1 ng hapon"), "13:00");
  assert.equal(parseStartTime("afternoon classes"), "12:00");
  assert.equal(parseStartTime("all levels"), null);
});

test("line shape", () => {
  assert.equal(parseLine("ALBAY"), null);
  assert.equal(parseLine("Iloilo City"), null);
  const p = parseLine("Guagua - face-to-face classes suspended (all levels, public and private)")!;
  assert.equal(p.place, "Guagua");
  assert.equal(p.f2fOnly, true);
  assert.equal(parseLine("Cavite City: All Levels, Public and Private, including government offices.")!.includesWork, true);
});

test("San Fernando, Pampanga is matched, with its Facebook link", () => {
  const a = run(`<p><a href="https://www.facebook.com/cityofsanfernandopampanga/posts/1">San Fernando, Pampanga</a> - all levels, public and private</p>`);
  assert.equal(a.length, 1);
  assert.equal(a[0].areaCode, SAN_FERNANDO);
  assert.deepEqual(a[0].dates, ["2026-11-13"]);
  assert.equal(a[0].levels, "all");
  assert.equal(a[0].sector, "both");
  assert.match(a[0].lguPostUrl!, /facebook\.com/);
});

test("other provinces' look-alike towns are NOT matched", () => {
  assert.equal(run(`<p>San Luis, Batangas - all levels public and private</p>`).length, 0);
  assert.equal(run(`<p>City of San Fernando, La Union - all levels</p>`).length, 0);
  assert.equal(run(`<p>Sto. Tomas, Batangas - all levels</p>`).length, 0);
  assert.equal(run(`<p>Taal, Batangas - all levels, public and private</p>`).length, 0);
});

test("province heading gives context to plain town names", () => {
  const a = run(`<p>PAMPANGA</p><p>San Luis - all levels</p><p>Lubao - Kinder to Grade 6, public</p><p>BATANGAS</p><p>San Luis - all levels</p>`);
  assert.deepEqual(a.map((x) => x.areaName), ["San Luis", "Lubao"]);
  assert.deepEqual(a[1].levels, ["kinder", "elementary"]);
  assert.equal(a[1].sector, "public");
});

test("unique Pampanga towns match without the province name", () => {
  const a = run(`<p>Angeles City - all levels</p><p>Mabalacat - starting 1 p.m., all levels</p>`);
  assert.deepEqual(a.map((x) => x.areaName), ["City of Angeles", "Mabalacat City"]);
  assert.equal(a[1].startsAt, "13:00");
});

test("whole province", () => {
  const a = run(`<p>Pampanga province - all levels, public and private</p>`);
  assert.equal(a.length, 1);
  assert.equal(a[0].areaCode, PAMPANGA);
});

test("individual schools are ignored", () => {
  const a = run(`<p>City of San Fernando, Pampanga</p><ul><li>Pampanga High School – Face-to-face classes suspended</li></ul><p>City College of San Fernando, Pampanga - classes suspended</p>`);
  assert.equal(a.length, 0);
});

test("Filipino articles: places as bullets, '--' separator", () => {
  const a = run(`<p>Suspendido ang klase sa ilang lugar.</p><ul> <li><a href="https://www.facebook.com/x">Guagua, Pampanga</a>-- all levels, public and private, shift to online alternative modes of learning</li> <li><a href="https://www.facebook.com/y">Tiwi, Albay</a>-- all levels</li> <li>Apalit, Pampanga &mdash; Kinder hanggang Grade 6</li></ul>`);
  assert.deepEqual(a.map((x) => x.areaName), ["Guagua", "Apalit"]);
  assert.equal(a[0].f2fOnly, true);
  assert.equal(a[0].lguPostUrl, "https://www.facebook.com/x");
  assert.deepEqual(a[1].levels, ["kinder", "elementary"]);
});

test("special non-working day", () => {
  const a = run(`<p>Pampanga - Special non-working holiday</p>`);
  assert.equal(a[0].kind, "holiday");
  assert.equal(a[0].includesWork, true);
});
