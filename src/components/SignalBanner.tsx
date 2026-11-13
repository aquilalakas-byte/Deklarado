import type { WindSignal } from "@/lib/types";
import { ExternalIcon } from "./Icons";

const STYLE: Record<number, string> = {
  1: "border-info/40 bg-info-soft text-info",
  2: "border-warn/40 bg-warn-soft text-warn",
  3: "border-danger/40 bg-danger-soft text-danger",
  4: "border-danger/40 bg-danger-soft text-danger",
  5: "border-danger/40 bg-danger-soft text-danger",
};

/** PAGASA Wind Signal for the user's town. It's a weather alert — suspensions are announced separately. */
export function SignalBanner({ signal }: { signal: WindSignal }) {
  return (
    <section className={`rounded-2xl border p-4 ${STYLE[signal.level] ?? STYLE[1]}`} role="status">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/10 text-lg font-bold" aria-hidden="true">
          {signal.level}
        </span>
        <div className="min-w-0">
          <p className="font-bold">Wind Signal No. {signal.level} is up</p>
          <p className="text-sm opacity-90">{signal.storm ?? "Tropical cyclone"}{signal.issued && <> · PAGASA, issued {signal.issued}</>}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-text">
        This is a weather alert, not a class suspension. Watch for announcements from your LGU or school.
      </p>
      {signal.bulletin_url && (
        <a href={signal.bulletin_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline">
          PAGASA bulletin <ExternalIcon width={14} height={14} />
        </a>
      )}
    </section>
  );
}
