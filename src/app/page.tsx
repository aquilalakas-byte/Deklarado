"use client";

import Link from "next/link";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { AreaPicker } from "@/components/AreaPicker";
import { Logo } from "@/components/Header";
import { DemoBanner, Disclaimer, ErrorBox, LastChecked } from "@/components/Notices";
import { SignalBanner } from "@/components/SignalBanner";
import { StatusCard, StatusSkeleton } from "@/components/StatusCard";
import { affectingCodes, displayName, getArea } from "@/lib/areas";
import { addDays, manilaToday, shortDate } from "@/lib/dates";
import { usePrefs } from "@/lib/prefs";
import { dayStatus } from "@/lib/status";
import { LEVELS } from "@/lib/types";
import { useAnnouncements } from "@/lib/useAnnouncements";

export default function HomePage() {
  const { prefs, ready, update } = usePrefs();

  if (!ready) return <div className="space-y-3"><StatusSkeleton big /><StatusSkeleton /></div>;
  if (!prefs.areaCode || !getArea(prefs.areaCode)) return <Welcome onPick={(code) => update({ areaCode: code })} />;
  return <Today areaCode={prefs.areaCode} />;
}

function Welcome({ onPick }: { onPick: (code: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="pt-4 text-center">
        <div className="flex justify-center"><Logo size={64} /></div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">May pasok ba bukas?</h1>
        <p className="mt-2 text-muted">
          Deklarado checks trusted sources every few hours and tells you if classes are suspended in your area.
        </p>
      </div>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">Where are you?</h2>
        <AreaPicker value={null} onChange={onPick} />
      </section>
      <Disclaimer />
    </div>
  );
}

function Today({ areaCode }: { areaCode: string }) {
  const { prefs } = usePrefs();
  const today = manilaToday();
  const tomorrow = addDays(today, 1);
  const { data, error, loading } = useAnnouncements(affectingCodes(areaCode), today, addDays(today, 7));
  const area = getArea(areaCode)!;

  const all = data?.announcements ?? [];
  const todayStatus = dayStatus(all, today, prefs.levels);
  const tomorrowStatus = dayStatus(all, tomorrow, prefs.levels);
  const later = all.filter((a) => a.date_covered > tomorrow);
  const levelNote = prefs.levels.length === 0 ? "all levels" : LEVELS.filter((l) => prefs.levels.includes(l.id)).map((l) => l.short).join(", ");

  return (
    <div className="space-y-4">
      {data?.demo && <DemoBanner />}
      {error && <ErrorBox message={error} />}

      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">{displayName(area)}</h1>
        <Link href="/settings" className="text-sm text-muted hover:text-text">For {levelNote}</Link>
      </div>

      {data?.signals.filter((s) => s.area_code === areaCode).map((s) => <SignalBanner key={s.area_code} signal={s} />)}

      {loading ? (
        <><StatusSkeleton big /><StatusSkeleton /></>
      ) : (
        <>
          <StatusCard label="Today" date={shortDate(today)} status={todayStatus} big />
          <StatusCard label="Tomorrow" date={shortDate(tomorrow)} status={tomorrowStatus} />
        </>
      )}

      {!loading && (todayStatus.matches.length > 0 || tomorrowStatus.matches.length > 0) && (
        <section className="space-y-3">
          <h2 className="pt-2 font-semibold">Details</h2>
          {[...todayStatus.matches, ...tomorrowStatus.matches].map((a) => <AnnouncementCard key={a.id} a={a} showDate />)}
        </section>
      )}

      {!loading && later.length > 0 && (
        <section className="space-y-3">
          <h2 className="pt-2 font-semibold">Coming up this week</h2>
          {later.map((a) => <AnnouncementCard key={a.id} a={a} showDate />)}
        </section>
      )}

      {data && <LastChecked sources={data.sources} />}
      <Disclaimer />
    </div>
  );
}
