import type { DayStatus } from "@/lib/status";

const STYLE: Record<DayStatus["state"], { card: string; dot: string; label: string }> = {
  none: { card: "border-line bg-surface", dot: "bg-ok", label: "text-ok" },
  suspended: { card: "border-transparent bg-alert text-white", dot: "bg-white", label: "text-white/85" },
  holiday: { card: "border-transparent bg-alert text-white", dot: "bg-white", label: "text-white/85" },
  partial: { card: "border-warn/30 bg-warn-soft", dot: "bg-warn", label: "text-warn" },
  online: { card: "border-info/30 bg-info-soft", dot: "bg-info", label: "text-info" },
};

export function StatusCard({ label, date, status, big = false }: { label: string; date: string; status: DayStatus; big?: boolean }) {
  const s = STYLE[status.state];
  const strong = status.state === "suspended" || status.state === "holiday";
  return (
    <section className={`rounded-3xl border p-5 ${s.card}`} aria-live="polite">
      <div className={`flex items-center gap-2 text-sm font-medium ${s.label}`}>
        <span className={`size-2 rounded-full ${s.dot}`} />
        {label} · {date}
      </div>
      <p className={`mt-2 font-bold tracking-tight ${big ? "text-4xl" : "text-2xl"} ${strong ? "uppercase" : ""}`}>{status.headline}</p>
      <p className={`mt-1 text-sm ${strong ? "text-white/90" : "text-muted"}`}>{status.detail}</p>
    </section>
  );
}

export function StatusSkeleton({ big = false }: { big?: boolean }) {
  return (
    <div className="animate-pulse rounded-3xl border border-line bg-surface p-5">
      <div className="h-4 w-32 rounded bg-surface-2" />
      <div className={`mt-3 rounded bg-surface-2 ${big ? "h-10 w-56" : "h-7 w-44"}`} />
      <div className="mt-2 h-4 w-64 rounded bg-surface-2" />
    </div>
  );
}
