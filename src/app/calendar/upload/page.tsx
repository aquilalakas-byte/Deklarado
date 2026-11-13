"use client";

// Add school calendar: pick a photo → read it on the phone (OCR, no upload) → review → save.
// Also used for adding a single event by hand: /calendar/upload?manual=YYYY-MM-DD

import Link from "next/link";
import { useRef, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Loading } from "@/components/Notices";
import { usePersonalEvents } from "@/lib/calendar";
import { manilaToday } from "@/lib/dates";
import { useT, type TKey } from "@/lib/i18n";
import { parseCalendarText, type EventKind } from "@/lib/parseCalendar";

type Row = { key: string; include: boolean; title: string; start: string; end: string; kind: EventKind; line?: string };

const newKey = () => Math.random().toString(36).slice(2);

export default function UploadPage() {
  return <ClientOnly fallback={<Loading />}><Upload /></ClientOnly>;
}

/** Big photos are slow to read — shrink to at most 2000px on the long side first. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  if (scale === 1) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.92));
}

function Upload() {
  const { t } = useT();
  const { add } = usePersonalEvents();
  const today = manilaToday();
  const manualDate = new URLSearchParams(window.location.search).get("manual");
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"pick" | "reading" | "review" | "saved">(manualDate ? "review" : "pick");
  const [pct, setPct] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [rows, setRows] = useState<Row[]>(
    manualDate && /^\d{4}-\d{2}-\d{2}$/.test(manualDate)
      ? [{ key: newKey(), include: true, title: "", start: manualDate, end: manualDate, kind: "event" }]
      : [],
  );

  async function read(file: File) {
    setPhase("reading");
    setPct(0);
    setNote(null);
    setPreview(URL.createObjectURL(file));
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setPct(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(await shrink(file));
      await worker.terminate();
      setRawText(data.text);
      const found = parseCalendarText(data.text, today);
      setRows(found.map((e) => ({ key: newKey(), include: true, title: e.title, start: e.start, end: e.end, kind: e.kind, line: e.line })));
      setNote(found.length ? { text: t("upload.found", { n: found.length }), tone: "ok" } : { text: t("upload.none"), tone: "warn" });
      setPhase("review");
    } catch {
      setNote({ text: t("upload.failed"), tone: "warn" });
      setPhase("review");
    }
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include && r.title.trim() && r.start);

  function save() {
    add(chosen.map((r) => ({ title: r.title.trim().slice(0, 80), start: r.start, end: r.end && r.end >= r.start ? r.end : r.start, kind: r.kind })));
    setPhase("saved");
  }

  const input = "w-full rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">{t("upload.title")}</h1>
        <Link href="/calendar" className="text-sm text-muted hover:text-text">{t("upload.back")}</Link>
      </div>

      {phase === "pick" && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm">{t("upload.intro")}</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink">
            📸 {t("upload.choose")}
          </button>
          <p className="text-xs text-muted">{t("upload.tips")}</p>
          <button type="button" onClick={() => { setRows([{ key: newKey(), include: true, title: "", start: today, end: today, kind: "event" }]); setPhase("review"); }}
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
            {t("cal.addManual")}
          </button>
        </section>
      )}

      {phase === "reading" && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 text-center">
          {/* A local photo the user just picked (blob: URL) — next/image can't optimize these */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" className="mx-auto max-h-48 rounded-lg object-contain" />}
          <p className="font-medium">{t("upload.reading", { pct })}</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-muted">{t("upload.firstTime")}</p>
        </section>
      )}

      {phase === "review" && (
        <>
          {note && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${note.tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{note.text}</p>}
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key} className={`space-y-2 rounded-2xl border bg-surface p-3 ${r.include ? "border-line" : "border-dashed border-line opacity-60"}`}>
                <label className="flex items-center gap-2 text-xs font-medium text-muted">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} className="size-4 accent-[var(--brand)]" />
                  {t("upload.include")}
                  {r.line && <span className="truncate font-normal italic">“{r.line}”</span>}
                </label>
                <label className="grid gap-1 text-xs text-muted">{t("upload.titleLabel")}
                  <input className={input} value={r.title} maxLength={80} onChange={(e) => update(r.key, { title: e.target.value })} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="grid gap-1 text-xs text-muted">{t("upload.start")}
                    <input type="date" className={input} value={r.start} onChange={(e) => update(r.key, { start: e.target.value, end: r.end < e.target.value ? e.target.value : r.end })} />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">{t("upload.end")}
                    <input type="date" className={input} value={r.end} min={r.start} onChange={(e) => update(r.key, { end: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">{t("upload.kind")}
                    <select className={input} value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value as EventKind })}>
                      {(["no_class", "exam", "event"] as const).map((k) => <option key={k} value={k}>{t(`kindEv.${k}` as TKey)}</option>)}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRows((rs) => [...rs, { key: newKey(), include: true, title: "", start: rs.at(-1)?.start ?? today, end: rs.at(-1)?.start ?? today, kind: "event" }])}
            className="w-full rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-text">
            {t("upload.addRow")}
          </button>
          <p className="text-xs text-muted">{t("upload.private")}</p>
          <button type="button" onClick={save} disabled={chosen.length === 0} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-50">
            {t("upload.save", { n: chosen.length })}
          </button>
          {rawText && (
            <details className="rounded-xl border border-line bg-surface p-3 text-xs">
              <summary className="cursor-pointer font-medium text-muted">{t("upload.showText")}</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-muted">{rawText}</pre>
            </details>
          )}
        </>
      )}

      {phase === "saved" && (
        <section className="space-y-3 rounded-2xl border border-ok/30 bg-ok-soft p-4 text-center">
          <p className="font-semibold text-ok">✅ {t("upload.saved")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/calendar" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">{t("upload.back")}</Link>
            <button type="button" onClick={() => { setRows([]); setRawText(""); setPreview(null); setPhase("pick"); }} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold">
              {t("upload.another")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
