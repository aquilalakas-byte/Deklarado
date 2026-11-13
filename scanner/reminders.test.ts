import { test } from "node:test";
import assert from "node:assert/strict";
import holidayData from "../src/data/holidays.json" with { type: "json" };
import { eventMessage, holidayMessage, isReminderWindow } from "./reminders.ts";

const bonifacio = holidayData.holidays.find((h) => h.date === "2026-11-30")!;

test("holiday list is valid", () => {
  const dates = holidayData.holidays.map((h) => h.date);
  assert.equal(new Set(dates).size, dates.length, "no duplicate dates");
  for (const h of holidayData.holidays) {
    assert.match(h.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["regular", "special", "special_working"].includes(h.type), h.date);
    assert.ok(h.name && h.nameFil, h.date);
  }
  assert.equal(bonifacio.name, "Bonifacio Day");
});

test("holiday reminder text", () => {
  assert.deepEqual(holidayMessage(bonifacio, "en"), {
    title: "Tomorrow: Holiday — Bonifacio Day. Walang pasok.",
    body: "Monday, November 30 · Regular holiday",
    url: "/calendar",
    tag: "holiday-2026-11-30",
  });
  assert.equal(holidayMessage(bonifacio, "fil").title, "Bukas: Holiday — Araw ni Bonifacio. Walang pasok.");
});

test("school event reminder text", () => {
  const e = { endpoint: "x", start_date: "2026-12-18", end_date: "2027-01-04", title: "Christmas Break", kind: "no_class" };
  assert.equal(eventMessage(e, "en").title, "Tomorrow: No classes — Christmas Break");
  assert.match(eventMessage(e, "en").body, /until Monday, January 4/);
  assert.equal(eventMessage(e, "fil").title, "Bukas: Walang klase — Christmas Break");
  assert.equal(eventMessage({ ...e, kind: "exam", title: "Midterm Exams", end_date: e.start_date }, "en").title, "Tomorrow: Midterm Exams");
});

test("reminders go out on the 6 PM run only", () => {
  assert.equal(isReminderWindow(18), true);
  assert.equal(isReminderWindow(17), true);
  assert.equal(isReminderWindow(21), false);
  assert.equal(isReminderWindow(9), false);
});
