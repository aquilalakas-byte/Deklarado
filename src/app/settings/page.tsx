"use client";

import { AreaPicker } from "@/components/AreaPicker";
import { ClientOnly } from "@/components/ClientOnly";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Disclaimer } from "@/components/Notices";
import { getArea, placeLabel } from "@/lib/areas";
import { usePrefs } from "@/lib/prefs";
import { LEVELS, type Level } from "@/lib/types";

export default function SettingsPage() {
  return <ClientOnly fallback={<p className="py-6 text-center text-sm text-muted">Loading…</p>}><Settings /></ClientOnly>;
}

function Settings() {
  const { prefs, update } = usePrefs();
  const area = getArea(prefs.areaCode);
  const allLevels = prefs.levels.length === 0;

  function toggle(level: Level) {
    const next = prefs.levels.includes(level) ? prefs.levels.filter((l) => l !== level) : [...prefs.levels, level];
    // Ticking every level is the same as "All levels"
    update({ levels: next.length === LEVELS.length ? [] : next });
  }

  const card = "rounded-2xl border border-line bg-surface p-4";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Settings</h1>

      <section className={card}>
        <h2 className="font-semibold">Your area</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          {area ? <>Showing announcements for <strong className="text-text">{placeLabel(area.code)}</strong>, plus province-wide and nationwide ones.</> : "Choose where you live or study."}
        </p>
        <AreaPicker value={prefs.areaCode} onChange={(code) => update({ areaCode: code })} />
      </section>

      <section className={card}>
        <h2 className="font-semibold">School levels you follow</h2>
        <p className="mb-3 mt-1 text-sm text-muted">The Today screen and notifications only count suspensions for these levels.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update({ levels: [] })}
            aria-pressed={allLevels}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${allLevels ? "border-brand bg-brand text-brand-ink" : "border-line text-muted hover:text-text"}`}
          >
            All levels
          </button>
          {LEVELS.map((l) => {
            const on = prefs.levels.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-text"}`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </section>

      <NotificationSettings areaCode={prefs.areaCode} levels={prefs.levels} />

      <section className={card}>
        <h2 className="font-semibold">About the sources</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li><strong className="text-text">GMA News – Walang Pasok:</strong> nationwide suspension lists, usually with links to each LGU&apos;s own post. Checked every 3 hours.</li>
          <li><strong className="text-text">City of San Fernando website:</strong> official announcements (RSS).</li>
          <li><strong className="text-text">Coming next:</strong> PAGASA typhoon signals, DepEd and PIA.</li>
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
