"use client";

import Link from "next/link";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { AreaPicker } from "@/components/AreaPicker";
import { Logo } from "@/components/Header";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { DemoBanner, Disclaimer, ErrorBox, LastChecked, OfflineBanner } from "@/components/Notices";
import { SignalBanner } from "@/components/SignalBanner";
import { StatusCard, StatusSkeleton } from "@/components/StatusCard";
import { affectingCodes, displayName, getArea } from "@/lib/areas";
import { addDays, manilaToday, shortDate } from "@/lib/dates";
import { levelName, useT } from "@/lib/i18n";
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
  const { t } = useT();
  return (
    <div className="space-y-6">
      <div className="pt-4 text-center">
        <div className="flex justify-center"><Logo size={64} /></div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{t("welcome.title")}</h1>
        <p className="mt-2 text-muted">{t("welcome.body")}</p>
      </div>
      <LanguageSwitch />
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">{t("welcome.where")}</h2>
        <AreaPicker value={null} onChange={onPick} />
      </section>
      <Disclaimer />
    </div>
  );
}

function Today({ areaCode }: { areaCode: string }) {
  const { prefs } = usePrefs();
  const { t, lang } = useT();
  const today = manilaToday();
  const tomorrow = addDays(today, 1);
  const { data, error, loading, offline, savedAt } = useAnnouncements(affectingCodes(areaCode), today, addDays(today, 7));
  const area = getArea(areaCode)!;

  const all = data?.announcements ?? [];
  const todayStatus = dayStatus(all, today, prefs.levels, t);
  const tomorrowStatus = dayStatus(all, tomorrow, prefs.levels, t);
  const later = all.filter((a) => a.date_covered > tomorrow);
  const levelNote = prefs.levels.length === 0
    ? t("today.allLevels")
    : LEVELS.filter((l) => prefs.levels.includes(l.id)).map((l) => levelName(t, l.id, true)).join(", ");

  return (
    <div className="space-y-4">
      {offline && <OfflineBanner savedAt={savedAt} />}
      {data?.demo && <DemoBanner />}
      {error && <ErrorBox message={error} />}

      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">{displayName(area)}</h1>
        <Link href="/settings" className="text-sm text-muted hover:text-text">{t("today.for", { levels: levelNote })}</Link>
      </div>

      {data?.signals.filter((s) => s.area_code === areaCode).map((s) => <SignalBanner key={s.area_code} signal={s} />)}

      {loading ? (
        <><StatusSkeleton big /><StatusSkeleton /></>
      ) : (
        <>
          <StatusCard label={t("today.today")} date={shortDate(today, lang)} status={todayStatus} big />
          <StatusCard label={t("today.tomorrow")} date={shortDate(tomorrow, lang)} status={tomorrowStatus} />
        </>
      )}

      {!loading && (todayStatus.matches.length > 0 || tomorrowStatus.matches.length > 0) && (
        <section className="space-y-3">
          <h2 className="pt-2 font-semibold">{t("today.details")}</h2>
          {[...todayStatus.matches, ...tomorrowStatus.matches].map((a) => <AnnouncementCard key={a.id} a={a} showDate />)}
        </section>
      )}

      {!loading && later.length > 0 && (
        <section className="space-y-3">
          <h2 className="pt-2 font-semibold">{t("today.comingUp")}</h2>
          {later.map((a) => <AnnouncementCard key={a.id} a={a} showDate />)}
        </section>
      )}

      {data && <LastChecked sources={data.sources} />}
      <Disclaimer />
    </div>
  );
}
