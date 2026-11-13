"use client";

import Link from "next/link";
import { useState } from "react";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { ClientOnly } from "@/components/ClientOnly";
import { ChevronLeft, ChevronRight } from "@/components/Icons";
import { DemoBanner, ErrorBox, Loading, OfflineBanner } from "@/components/Notices";
import { StatusCard } from "@/components/StatusCard";
import { affectingCodes, displayName, getArea } from "@/lib/areas";
import { longDate, manilaToday, monthLabel, shortDate } from "@/lib/dates";
import { useT, type TKey } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { eventsOn, holidayOn, usePersonalEvents } from "@/lib/calendar";
import { dayStatus, withCalendar, type DayState } from "@/lib/status";
import { useAnnouncements } from "@/lib/useAnnouncements";

const DOT: Record<DayState, string> = {
  none: "",
  suspended: "bg-danger",
  holiday: "bg-danger",
  partial: "bg-warn",
  online: "bg-info",
  school: "bg-brand",
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  return <ClientOnly fallback={<Loading />}><CalendarView /></ClientOnly>;
}

function CalendarView() {
  const { prefs } = usePrefs();
  const { t, lang } = useT();
  const { events, remove } = usePersonalEvents();
  const today = manilaToday();
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [selected, setSelected] = useState(today);

  const area = getArea(prefs.areaCode);
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const from = `${ym.y}-${pad(ym.m)}-01`;
  const to = `${ym.y}-${pad(ym.m)}-${pad(daysInMonth)}`;
  const { data, error, loading, offline, savedAt } = useAnnouncements(area ? affectingCodes(area.code) : null, from, to);

  const all = data?.announcements ?? [];
  const move = (delta: number) => {
    const d = new Date(Date.UTC(ym.y, ym.m - 1 + delta, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };
  // Suspensions + holidays + my school events, for one day
  const statusOn = (date: string) => withCalendar(dayStatus(all, date, prefs.levels, t), holidayOn(date), eventsOn(events, date), t, lang);
  const sel = statusOn(selected);
  const selHoliday = holidayOn(selected);
  const selEvents = eventsOn(events, selected);

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${ym.y}-${pad(ym.m)}-${pad(i + 1)}`),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t("cal.title")}</h1>
        {area && <span className="text-sm text-muted">{displayName(area)}</span>}
      </div>
      {!area && (
        <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          {t("cal.setArea.body")}{" "}
          <Link href="/settings" className="font-semibold text-brand hover:underline">{t("cal.chooseArea")}</Link>
        </div>
      )}
      {offline && <OfflineBanner savedAt={savedAt} />}
      {data?.demo && <DemoBanner />}
      {error && <ErrorBox message={error} />}

      <section className="rounded-2xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} aria-label={t("cal.prev")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"><ChevronLeft width={20} height={20} /></button>
          <h2 className="font-semibold">{monthLabel(ym.y, ym.m, lang)}</h2>
          <button type="button" onClick={() => move(1)} aria-label={t("cal.next")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"><ChevronRight width={20} height={20} /></button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
          {t("cal.weekdays").split(",").map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`}>
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const state = statusOn(date).state;
            const hasEvent = eventsOn(events, date).length > 0;
            const isSel = date === selected;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-label={`${longDate(date, lang)}${state !== "none" ? t("cal.hasSuspension") : ""}`}
                aria-pressed={isSel}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition
                  ${isSel ? "bg-brand text-brand-ink" : isToday ? "bg-brand-soft font-semibold text-brand" : "hover:bg-surface-2"}`}
              >
                {Number(date.slice(8))}
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {state !== "none" && <span className={`size-1.5 rounded-full ${isSel ? "bg-brand-ink" : DOT[state]}`} />}
                  {hasEvent && state !== "school" && <span className={`size-1.5 rounded-full border ${isSel ? "border-brand-ink" : "border-brand"}`} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-danger" /> {t("cal.legend.none")} / {t("cal.legend.holiday")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warn" /> {t("cal.legend.partial")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-info" /> {t("cal.legend.online")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-brand" /> {t("cal.legend.school")}</span>
        </div>
      </section>

      <StatusCard label={selected === today ? t("today.today") : t("cal.selected")} date={shortDate(selected, lang)} status={sel} />
      {selHoliday?.type === "special_working" && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          {t("holiday.working", { name: lang === "fil" ? selHoliday.nameFil : selHoliday.name })}
        </p>
      )}
      {sel.matches.map((a) => <AnnouncementCard key={a.id} a={a} />)}

      <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold">{t("school.myEvents")}</h2>
        {selEvents.length > 0 ? (
          <ul className="space-y-2">
            {selEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="text-xs text-muted">
                    {t(`kindEv.${e.kind}` as TKey)} · {shortDate(e.start, lang)}{e.end !== e.start && <> – {shortDate(e.end, lang)}</>}
                  </span>
                </span>
                <button type="button" onClick={() => remove(e.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft">{t("cal.delete")}</button>
              </li>
            ))}
          </ul>
        ) : (
          events.length === 0 && <p className="text-sm text-muted">{t("cal.myEventsEmpty")}</p>
        )}
        <div className="grid gap-2 pt-1 sm:grid-cols-2">
          <Link href="/calendar/upload" className="rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-ink">📸 {t("cal.addPhoto")}</Link>
          <Link href={`/calendar/upload?manual=${selected}`} className="rounded-xl border border-line px-4 py-2.5 text-center text-sm font-semibold hover:bg-surface-2">{t("cal.addManual")}</Link>
        </div>
      </section>
    </div>
  );
}
