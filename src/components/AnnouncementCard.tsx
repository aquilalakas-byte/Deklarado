import { placeLabel } from "@/lib/areas";
import { shortDate, timeLabel } from "@/lib/dates";
import { levelsText, sectorText } from "@/lib/status";
import type { Announcement } from "@/lib/types";
import { ExternalIcon, ShieldIcon } from "./Icons";

const KIND_LABEL: Record<Announcement["kind"], string> = {
  class_suspension: "Class suspension",
  work_suspension: "Work suspension",
  holiday: "Non-working day",
  resumption: "Classes resume",
};

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
  const tone = a.kind === "resumption" ? "ok" : a.kind === "holiday" ? "danger" : a.f2f_only ? "info" : a.starts_at ? "warn" : "danger";
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{placeLabel(a.area_code)}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {showDate && <>{shortDate(a.date_covered)} · </>}
            {KIND_LABEL[a.kind]}
          </p>
        </div>
        {a.is_official && (
          <span title="Official government source" className="flex shrink-0 items-center gap-1 text-xs font-medium text-ok">
            <ShieldIcon width={14} height={14} /> Official
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.kind !== "resumption" && <Tag tone={tone}>{a.f2f_only ? "No face-to-face classes" : a.starts_at ? `From ${timeLabel(a.starts_at)}` : "Whole day"}</Tag>}
        {a.kind !== "holiday" && <Tag>{levelsText(a)}</Tag>}
        {a.kind !== "holiday" && <Tag>{sectorText(a.sector)}</Tag>}
        {a.includes_work && a.kind !== "holiday" && <Tag tone="warn">Gov&apos;t work suspended</Tag>}
      </div>

      {a.reason && <p className="mt-3 text-sm"><span className="text-muted">Reason:</span> {a.reason}</p>}
      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">&ldquo;{a.summary}&rdquo;</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          {a.is_official ? a.source_name : `Reported by ${a.source_name.split(" – ")[0]}`} <ExternalIcon width={14} height={14} />
        </a>
        {a.lgu_post_url && (
          <a href={a.lgu_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            LGU&apos;s own post <ExternalIcon width={14} height={14} />
          </a>
        )}
      </div>
    </article>
  );
}
