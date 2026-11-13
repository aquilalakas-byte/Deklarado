import { timeAgo } from "@/lib/dates";
import type { SourceStatus } from "@/lib/types";

export function DemoBanner() {
  return (
    <div className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn" role="note">
      <strong>Demo data.</strong> These are sample announcements — the live database isn&apos;t connected yet.
    </div>
  );
}

export function LastChecked({ sources }: { sources: SourceStatus[] }) {
  const latest = sources.map((s) => s.last_checked_at).filter(Boolean).sort().at(-1);
  const failing = sources.filter((s) => s.last_error);
  return (
    <p className="text-center text-xs text-muted">
      {latest ? <>Sources last checked {timeAgo(latest)}</> : "Sources not checked yet"}
      {failing.length > 0 && <> · {failing.length} source{failing.length > 1 ? "s" : ""} had a problem</>}
    </p>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
      Couldn&apos;t load announcements: {message}. Check your connection and try again.
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="text-center text-xs leading-relaxed text-muted">
      Deklarado collects announcements automatically and can make mistakes. Always confirm with your LGU or school&apos;s official post.
    </p>
  );
}
