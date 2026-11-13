"use client";

import Link from "next/link";
import { useState } from "react";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { ClientOnly } from "@/components/ClientOnly";
import { ChevronLeft, ChevronRight } from "@/components/Icons";
import { DemoBanner, ErrorBox } from "@/components/Notices";
import { StatusCard } from "@/components/StatusCard";
import { affectingCodes, displayName, getArea } from "@/lib/areas";
import { longDate, manilaToday, monthLabel, shortDate } from "@/lib/dates";
import { usePrefs } from "@/lib/prefs";
import { dayStatus, type DayState } from "@/lib/status";
import { useAnnouncements } from "@/lib/useAnnouncements";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOT: Record<DayState, string> = {
  none: "",
  suspended: "bg-danger",
  holiday: "bg-danger",
  partial: "bg-warn",
  online: "bg-info",
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  return <ClientOnly fallback={<p className="py-6 text-center text-sm text-muted">Loading…</p>}><CalendarView /></ClientOnly>;
}

function CalendarView() {
  const { prefs } = usePrefs();
  const today = manilaToday();
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [selected, setSelected] = useState(today);

  const area = getArea(prefs.areaCode);
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const from = `${ym.y}-${pad(ym.m)}-01`;
  const to = `${ym.y}-${pad(ym.m)}-${pad(daysInMonth)}`;
  const { data, error, loading } = useAnnouncements(area ? affectingCodes(area.code) : null, from, to);

  if (!area) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">Set your area first</p>
        <p className="mt-1 text-sm text-muted">The calendar shows suspensions for your city or town.</p>
        <Link href="/settings" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 font-semibold text-brand-ink">Choose area</Link>
      </div>
    );
  }

  const all = data?.announcements ?? [];
  const move = (delta: number) => {
    const d = new Date(Date.UTC(ym.y, ym.m - 1 + delta, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };
  const sel = dayStatus(all, selected, prefs.levels);

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${ym.y}-${pad(ym.m)}-${pad(i + 1)}`),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
        <span className="text-sm text-muted">{displayName(area)}</span>
      </div>
      {data?.demo && <DemoBanner />}
      {error && <ErrorBox message={error} />}

      <section className="rounded-2xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"><ChevronLeft width={20} height={20} /></button>
          <h2 className="font-semibold">{monthLabel(ym.y, ym.m)}</h2>
          <button type="button" onClick={() => move(1)} aria-label="Next month" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"><ChevronRight width={20} height={20} /></button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`}>
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const state = dayStatus(all, date, prefs.levels).state;
            const isSel = date === selected;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-label={`${longDate(date)}${state !== "none" ? ", has a suspension" : ""}`}
                aria-pressed={isSel}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition
                  ${isSel ? "bg-brand text-brand-ink" : isToday ? "bg-brand-soft font-semibold text-brand" : "hover:bg-surface-2"}`}
              >
                {Number(date.slice(8))}
                <span className={`mt-0.5 size-1.5 rounded-full ${state === "none" ? "bg-transparent" : isSel ? "bg-brand-ink" : DOT[state]}`} />
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-danger" /> No classes</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warn" /> Some levels / half day</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-info" /> Online only</span>
        </div>
      </section>

      <StatusCard label={selected === today ? "Today" : "Selected day"} date={shortDate(selected)} status={sel} />
      {sel.matches.map((a) => <AnnouncementCard key={a.id} a={a} />)}
    </div>
  );
}
