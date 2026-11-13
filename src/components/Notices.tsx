"use client";

import { timeAgo } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { SourceStatus } from "@/lib/types";

/** Shown when the announcements are examples: either "Show sample data" is on, or the database isn't connected yet. */
export function DemoBanner() {
  const { t } = useT();
  const { prefs, update } = usePrefs();
  if (prefs.sample) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn" role="note">
        <span><strong>{t("sample.banner")}</strong> {t("sample.banner.body")}</span>
        <button type="button" onClick={() => update({ sample: false })} className="shrink-0 rounded-lg border border-warn/40 px-2 py-1 text-xs font-semibold hover:bg-warn/10">
          {t("sample.turnOff")}
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn" role="note">
      <strong>{t("notice.demo")}</strong> {t("notice.demo.body")}
    </div>
  );
}

/** Shown when the phone is offline and the app is showing announcements saved earlier. */
export function OfflineBanner({ savedAt }: { savedAt: string | null }) {
  const { t } = useT();
  const when = savedAt ? t("notice.offline.when", { ago: timeAgo(savedAt, t) }) : "";
  return (
    <div className="rounded-xl border border-info/30 bg-info-soft px-3 py-2 text-sm text-info" role="status">
      <strong>{t("notice.offline")}</strong> {t("notice.offline.body", { when })}
    </div>
  );
}

export function LastChecked({ sources }: { sources: SourceStatus[] }) {
  const { t } = useT();
  const latest = sources.map((s) => s.last_checked_at).filter(Boolean).sort().at(-1);
  const failing = sources.filter((s) => s.last_error).length;
  return (
    <p className="text-center text-xs text-muted">
      {latest ? t("notice.checked", { ago: timeAgo(latest, t) }) : t("notice.notChecked")}
      {failing > 0 && <> · {t("notice.problems", { n: failing })}</>}
    </p>
  );
}

export function ErrorBox({ message }: { message: string }) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
      {t("notice.error", { message })}
    </div>
  );
}

export function Disclaimer() {
  const { t } = useT();
  return <p className="text-center text-xs leading-relaxed text-muted">{t("notice.disclaimer")}</p>;
}

export function Loading() {
  const { t } = useT();
  return <p className="py-6 text-center text-sm text-muted">{t("loading")}</p>;
}
