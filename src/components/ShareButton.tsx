"use client";

import { useState } from "react";
import { placeLabel } from "@/lib/areas";
import { longDate, timeLabel } from "@/lib/dates";
import { useT, type T, type Lang, type TKey } from "@/lib/i18n";
import { levelsText, sectorText } from "@/lib/status";
import type { Announcement } from "@/lib/types";

/** The message people send to friends, e.g. in Messenger or SMS. */
export function shareText(a: Announcement, t: T, lang: Lang): string {
  const head = a.kind === "resumption"
    ? t("kind.resumption")
    : a.f2f_only ? t("status.online")
    : a.starts_at ? t("status.from", { time: timeLabel(a.starts_at) })
    : t("status.walangPasok").toUpperCase();
  const lines = [
    `${head} — ${placeLabel(a.area_code, t)}`,
    longDate(a.date_covered, lang),
    a.kind === "holiday" ? t(`kind.${a.kind}` as TKey) : `${levelsText(a, t)} · ${sectorText(a.sector, t)}`,
  ];
  if (a.reason) lines.push(`${t("card.reason")} ${a.reason}`);
  lines.push(a.lgu_post_url ?? a.source_url);
  return lines.join("\n");
}

export function ShareButton({ a }: { a: Announcement }) {
  const { t, lang } = useT();
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const text = shareText(a, t, lang);
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Deklarado", text: `${text}\n\n${t("share.via")}`, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n\n${t("share.via")}: ${url}`);
      setNote(t("share.copied"));
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // the user closed the share sheet
      setNote(t("share.failed"));
    }
    setTimeout(() => setNote(null), 3000);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {t("share.button")}
      </button>
      {note && <span role="status" className="text-xs text-muted">{note}</span>}
    </div>
  );
}
