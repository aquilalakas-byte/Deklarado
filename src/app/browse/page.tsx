"use client";

import { useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { DemoBanner, Disclaimer, ErrorBox, LastChecked } from "@/components/Notices";
import { descendantCodes, displayName, getArea, NATIONAL_CODE, provincesOf, regions, townsOf } from "@/lib/areas";
import { addDays, longDate, manilaToday } from "@/lib/dates";
import { usePrefs } from "@/lib/prefs";
import { appliesToLevels } from "@/lib/status";
import { LEVELS, type Announcement, type Level } from "@/lib/types";
import { useAnnouncements } from "@/lib/useAnnouncements";

type TimeFilter = "any" | "whole" | "later";

const PRESETS: { label: string; from: number; to: number }[] = [
  { label: "This week", from: -3, to: 7 },
  { label: "Upcoming", from: 0, to: 30 },
  { label: "Past 30 days", from: -30, to: 0 },
];

export default function BrowsePage() {
  return <ClientOnly fallback={<p className="py-6 text-center text-sm text-muted">Loading…</p>}><Browse /></ClientOnly>;
}

function Browse() {
  const { prefs } = usePrefs();
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
  const { data, error, loading } = useAnnouncements(from <= to ? codes : null, from, to);

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
      <h1 className="text-xl font-bold tracking-tight">Browse announcements</h1>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-label="Filters">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = from === addDays(today, p.from) && to === addDays(today, p.to);
            return (
              <button key={p.label} type="button" onClick={() => { setFrom(addDays(today, p.from)); setTo(addDays(today, p.to)); }}
                className={`rounded-full border px-3 py-1 text-sm ${active ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-text"}`}>
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>From<input type="date" className={input} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className={label}>To<input type="date" className={input} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          <label className={label}>Region
            <select className={input} value={region} onChange={(e) => { setRegion(e.target.value); setProvince(provincesOf(e.target.value)[0]?.code ?? ""); setTown("all"); }}>
              {regions().map((r) => <option key={r.code} value={r.code}>{displayName(r)}</option>)}
            </select>
          </label>
          <label className={label}>Province
            <select className={input} value={province} onChange={(e) => { setProvince(e.target.value); setTown("all"); }}>
              {provincesOf(region).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </label>
          <label className={`${label} col-span-2`}>City / Town
            <select className={input} value={town} onChange={(e) => setTown(e.target.value)}>
              <option value="all">All cities and towns</option>
              {townsOf(province).map((t) => <option key={t.code} value={t.code}>{displayName(t)}</option>)}
            </select>
          </label>
          <label className={label}>Level
            <select className={input} value={level} onChange={(e) => setLevel(e.target.value as Level | "all")}>
              <option value="all">All levels</option>
              {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className={label}>Time
            <select className={input} value={time} onChange={(e) => setTime(e.target.value as TimeFilter)}>
              <option value="any">Any time</option>
              <option value="whole">Whole day</option>
              <option value="later">Starts later in the day</option>
            </select>
          </label>
        </div>
        {from > to && <p className="text-sm text-danger">&ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.</p>}
      </section>

      {data?.demo && <DemoBanner />}
      {error && <ErrorBox message={error} />}
      {loading && <p className="py-6 text-center text-sm text-muted">Loading…</p>}

      {!loading && data && (
        <>
          <p className="text-sm text-muted">{filtered.length} announcement{filtered.length === 1 ? "" : "s"}</p>
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
              No suspensions found for these filters.
            </div>
          )}
          {[...byDate.entries()].map(([date, list]) => (
            <section key={date} className="space-y-3">
              <h2 className="sticky top-[57px] z-10 -mx-4 bg-bg/95 px-4 py-2 text-sm font-semibold backdrop-blur">
                {longDate(date)}{date === today && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">Today</span>}
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
