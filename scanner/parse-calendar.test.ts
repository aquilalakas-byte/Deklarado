// Tests for reading school-calendar photos (the OCR text → events part).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, parseCalendarText } from "../src/lib/parseCalendar.ts";

const TODAY = "2026-11-14";
const pick = (text: string) => parseCalendarText(text, TODAY).map((e) => [e.start, e.end, e.title, e.kind]);

test("typical list-style calendar", () => {
  const text = `
    FIRST SEMESTER, A.Y. 2026-2027
    August 12, 2026  Start of Classes
    October 12-16 — Midterm Examinations
    November 30, 2026 (Monday) Bonifacio Day - No Classes
    Dec 18, 2026 - Jan 4, 2027 : Christmas Break
    December 14-18  Final Examinations
  `;
  assert.deepEqual(pick(text), [
    ["2026-08-12", "2026-08-12", "Start of Classes", "event"],
    ["2026-10-12", "2026-10-16", "Midterm Examinations", "exam"],
    ["2026-11-30", "2026-11-30", "Bonifacio Day - No Classes", "no_class"],
    ["2026-12-18", "2027-01-04", "Christmas Break", "no_class"],
    ["2026-12-14", "2026-12-18", "Final Examinations", "exam"],
  ]);
});

test("dates without a year land in the current school year", () => {
  assert.deepEqual(pick("Jan 25-29 Prelim Exams"), [["2027-01-25", "2027-01-29", "Prelim Exams", "exam"]]);
  assert.deepEqual(pick("Oct 1 Foundation Day"), [["2026-10-01", "2026-10-01", "Foundation Day", "event"]]);
  assert.deepEqual(pick("Dec 21 - Jan 3 Christmas Vacation"), [["2026-12-21", "2027-01-03", "Christmas Vacation", "no_class"]]);
});

test("title before the date, dot leaders, numeric dates", () => {
  assert.deepEqual(pick("Midterm Exams .......... Oct 12-16"), [["2026-10-12", "2026-10-16", "Midterm Exams", "exam"]]);
  assert.deepEqual(pick("11/30 | Bonifacio Day (No Classes)"), [["2026-11-30", "2026-11-30", "Bonifacio Day (No Classes)", "no_class"]]);
  assert.deepEqual(pick("12/21/2026 - 01/03/2027 Semestral Break"), [["2026-12-21", "2027-01-03", "Semestral Break", "no_class"]]);
});

test("table layout: date on one line, activity on the next", () => {
  assert.deepEqual(pick("February 14, 2027\nIntramurals Opening"), [["2027-02-14", "2027-02-14", "Intramurals Opening", "event"]]);
});

test("ignores junk and impossible dates", () => {
  assert.deepEqual(pick("Page 1 of 2\nFebruary 30 Impossible Day\nwww.school.edu.ph"), []);
});

test("Filipino month names", () => {
  assert.deepEqual(pick("Disyembre 24 Walang klase"), [["2026-12-24", "2026-12-24", "Walang klase", "no_class"]]);
});

test("kind keywords", () => {
  assert.equal(classify("Final Examination"), "exam");
  assert.equal(classify("Semestral Break"), "no_class");
  assert.equal(classify("Freshmen Orientation"), "event");
});
