"use client";

import { useEffect, useState } from "react";
import { useT, type TKey } from "@/lib/i18n";
import type { Announcement } from "@/lib/types";

const REASONS = ["wrong_place", "wrong_date", "wrong_levels", "not_suspension", "other"] as const;
type Reason = (typeof REASONS)[number];

/** "Report a mistake" — saves a report for the team to review. No personal data is sent. */
export function ReportButton({ a }: { a: Announcement }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Escape closes the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send() {
    if (!reason) return;
    setState("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ announcementId: a.id, reason, note: note.trim().slice(0, 300) }),
      });
      if (!res.ok) throw new Error(t(res.status === 503 ? "report.unavailable" : "report.failed"));
      setState("done");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("report.failed"));
      setState("error");
    }
  }

  if (state === "done") return <span role="status" className="text-xs font-medium text-ok">{t("report.thanks")}</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text">
        {t("report.button")}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={`report-${a.id}`} onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id={`report-${a.id}`} className="font-semibold">{t("report.title")}</h2>
        <p className="mt-1 text-sm text-muted">&ldquo;{a.summary}&rdquo;</p>
        <fieldset className="mt-3 grid gap-2">
          {REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${reason === r ? "border-brand bg-brand-soft" : "border-line"}`}>
              <input type="radio" name={`reason-${a.id}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--brand)]" />
              {t(`report.${r}` as TKey)}
            </label>
          ))}
        </fieldset>
        <label className="mt-3 grid gap-1 text-sm font-medium">
          {t("report.note")}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t("report.notePlaceholder")}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <p className="mt-2 text-xs text-muted">{t("report.privacy")}</p>
        {state === "error" && <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
            {t("report.cancel")}
          </button>
          <button type="button" onClick={send} disabled={!reason || state === "sending"} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink disabled:opacity-50">
            {state === "sending" ? t("report.sending") : t("report.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
