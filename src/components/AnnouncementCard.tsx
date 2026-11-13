"use client";

import { placeLabel } from "@/lib/areas";
import { shortDate, timeLabel } from "@/lib/dates";
import { useT, type TKey } from "@/lib/i18n";
import { levelsText, sectorText } from "@/lib/status";
import type { Announcement } from "@/lib/types";
import { ExternalIcon, ShieldIcon } from "./Icons";
import { ReportButton } from "./ReportButton";
import { ShareButton } from "./ShareButton";

function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "danger" | "warn" | "info" | "ok" }) {
  const tones = {
    plain: "bg-surface-2 text-muted",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
    info: "bg-info-soft text-info",
    ok: "bg-ok-soft text-ok",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function AnnouncementCard({ a, showDate = false }: { a: Announcement; showDate?: boolean }) {
  const { t, lang } = useT();
  const tone = a.kind === "resumption" ? "ok" : a.kind === "holiday" ? "danger" : a.f2f_only ? "info" : a.starts_at ? "warn" : "danger";
  const source = a.source_name.split(" – ")[0];

  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{placeLabel(a.area_code, t)}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {showDate && <>{shortDate(a.date_covered, lang)} · </>}
            {t(`kind.${a.kind}` as TKey)}
          </p>
        </div>
        {a.is_official && (
          <span title={t("card.officialTitle")} className="flex shrink-0 items-center gap-1 text-xs font-medium text-ok">
            <ShieldIcon width={14} height={14} /> {t("card.official")}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.kind !== "resumption" && (
          <Tag tone={tone}>{a.f2f_only ? t("tag.noF2f") : a.starts_at ? t("tag.from", { time: timeLabel(a.starts_at) }) : t("tag.wholeDay")}</Tag>
        )}
        {a.kind !== "holiday" && <Tag>{levelsText(a, t)}</Tag>}
        {a.kind !== "holiday" && <Tag>{sectorText(a.sector, t)}</Tag>}
        {a.includes_work && a.kind !== "holiday" && <Tag tone="warn">{t("tag.govWork")}</Tag>}
      </div>

      {a.reason && <p className="mt-3 text-sm"><span className="text-muted">{t("card.reason")}</span> {a.reason}</p>}
      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">&ldquo;{a.summary}&rdquo;</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          {a.is_official ? source : t("card.reportedBy", { source })} <ExternalIcon width={14} height={14} />
        </a>
        {a.lgu_post_url && a.lgu_post_url !== a.source_url && (
          <a href={a.lgu_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            {t("card.lguPost")} <ExternalIcon width={14} height={14} />
          </a>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <ShareButton a={a} />
        <ReportButton a={a} />
      </div>
    </article>
  );
}
