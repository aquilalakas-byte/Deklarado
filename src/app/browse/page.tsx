"use client";

import { useState } from "react";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { ClientOnly } from "@/components/ClientOnly";
import { DemoBanner, Disclaimer, ErrorBox, LastChecked, Loading, OfflineBanner } from "@/components/Notices";
import { descendantCodes, displayName, getArea, NATIONAL_CODE, provincesOf, regions, townsOf } from "@/lib/areas";
import { addDays, longDate, manilaToday } from "@/lib/dates";
import { levelName, useT, type TKey } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { appliesToLevels } from "@/lib/status";
import { LEVELS, type Announcement, type Level } from "@/lib/types";
import { useAnnouncements } from "@/lib/useAnnouncements";

type TimeFilter = "any" | "whole" | "later";

const PRESETS: { label: TKey; from: number; to: number }[] = [
  { label: "browse.thisWeek", from: -3, to: 7 },
  { label: "browse.upcoming", from: 0, to: 30 },
  { label: "browse.past30", from: -30, to: 0 },
];

export default function BrowsePage() {
  return <ClientOnly fallback={<Loading />}><Browse /></ClientOnly>;
}

function Browse() {
  const { prefs } = usePrefs();
  const { t, lang } = useT();
  const today = manilaToday();
  const firstRegion = regions()[0]?.code ?? "";
  const home = getArea(prefs.areaCode);

  const [from, setFrom] = useState(addDays(today, -3));
  const [to, setTo] = useState(addDays(today, 7));
  const [region, setRegion] = useState(firstRegion);
  const [province, setProvince] = useState(home?.parent_code ?? provincesOf(firstRegion)[0]?.code ?? "");
  const [town, setTown] = useState<string>("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [time, setTime] = useState<TimeFilter>("any");

  // Which areas to ask for: one town (plus its province + nationwide), or the whole province.
  const codes = town === "all"
    ? [...descendantCodes(province), region, NATIONAL_CODE]
    : [town, province, region, NATIONAL_CODE];
  const { data, error, loading, offline, savedAt } = useAnnouncements(from <= to ? codes : null, from, to);

  const filtered = (data?.announcements ?? []).filter((a) =>
    appliesToLevels(a, level === "all" ? [] : [level]) &&
    (time === "any" || (time === "whole" ? !a.starts_at : !!a.starts_at)),
  );
  const byDate = new Map<string, Announcement[]>();
  for (const a of filtered) byDate.set(a.date_covered, [...(byDate.get(a.date_covered) ?? []), a]);

  const input = "w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
  const label = "grid gap-1 text-xs font-medium text-muted";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">{t("browse.title")}</h1>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-label={t("browse.filters")}>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = from === addDays(today, p.from) && to === addDays(today, p.to);
            return (
              <button key={p.label} type="button" onClick={() => { setFrom(addDays(today, p.from)); setTo(addDays(today, p.to)); }}
                className={`rounded-full border px-3 py-1 text-sm ${active ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-text"}`}>
                {t(p.label)}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>{t("browse.from")}<input type="date" className={input} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className={label}>{t("browse.to")}<input type="date" className={input} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          <label className={label}>{t("area.region")}
            <select className={input} value={region} onChange={(e) => { setRegion(e.target.value); setProvince(provincesOf(e.target.value)[0]?.code ?? ""); setTown("all"); }}>
              {regions().map((r) => <option key={r.code} value={r.code}>{displayName(r)}</option>)}
            </select>
          </label>
          <label className={label}>{t("area.province")}
            <select className={input} value={province} onChange={(e) => { setProvince(e.target.value); setTown("all"); }}>
              {provincesOf(region).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </label>
          <label className={`${label} col-span-2`}>{t("area.town")}
            <select className={input} value={town} onChange={(e) => setTown(e.target.value)}>
              <option value="all">{t("browse.allTowns")}</option>
              {townsOf(province).map((tw) => <option key={tw.code} value={tw.code}>{displayName(tw)}</option>)}
            </select>
          </label>
          <label className={label}>{t("browse.level")}
            <select className={input} value={level} onChange={(e) => setLevel(e.target.value as Level | "all")}>
              <option value="all">{t("browse.allLevels")}</option>
              {LEVELS.map((l) => <option key={l.id} value={l.id}>{levelName(t, l.id)}</option>)}
            </select>
          </label>
          <label className={label}>{t("browse.time")}
            <select className={input} value={time} onChange={(e) => setTime(e.target.value as TimeFilter)}>
              <option value="any">{t("browse.anyTime")}</option>
              <option value="whole">{t("browse.wholeDay")}</option>
              <option value="later">{t("browse.later")}</option>
            </select>
          </label>
        </div>
        {from > to && <p className="text-sm text-danger">{t("browse.badRange")}</p>}
      </section>

      {offline && <OfflineBanner savedAt={savedAt} />}
      {data?.demo && <DemoBanner />}
      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && data && (
        <>
          <p className="text-sm text-muted">{t("browse.count", { n: filtered.length })}</p>
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{t("browse.empty")}</div>
          )}
          {[...byDate.entries()].map(([date, list]) => (
            <section key={date} className="space-y-3">
              <h2 className="sticky top-[57px] z-10 -mx-4 bg-bg/95 px-4 py-2 text-sm font-semibold backdrop-blur">
                {longDate(date, lang)}
                {date === today && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">{t("browse.todayChip")}</span>}
              </h2>
              {list.map((a) => <AnnouncementCard key={a.id} a={a} />)}
            </section>
          ))}
          <LastChecked sources={data.sources} />
        </>
      )}
      <Disclaimer />
    </div>
  );
}
